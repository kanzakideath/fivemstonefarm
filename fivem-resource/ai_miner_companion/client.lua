local RESOURCE = GetCurrentResourceName()
local RESOURCE_VERSION = GetResourceMetadata(RESOURCE, 'version', 0) or '1.1.0'
local PROTOCOL = 'ai-miner-companion'
local PROTOCOL_VERSION = 1
local MANUAL_ACTION_CONTROLS = { 21, 22, 23, 36, 44 }

local function cargoProviderAvailable()
    if Config.Cargo.Mode == 'ox_inventory' then
        return GetResourceState('ox_inventory') == 'started'
    end
    if Config.Cargo.Mode == 'client_event' then return Config.Cargo.ClientEvent ~= '' end
    if Config.Cargo.Mode == 'server_event' then return Config.Cargo.ServerEvent ~= '' end
    return false
end

math.randomseed(GetGameTimer() + PlayerId() * 7919)
for _ = 1, 6 do math.random() end

local function randomHex(byteCount)
    local value = {}
    for i = 1, byteCount do value[i] = ('%02x'):format(math.random(0, 255)) end
    return table.concat(value)
end

local function emptyRegistration()
    return {
        registered = false,
        id = '',
        plate = '',
        model = 0,
        label = '',
        networkId = 0,
        lastSeen = 0,
        available = false,
        availabilityCode = ''
    }
end

local function emptyRegistrationTransaction()
    return {
        pending = false,
        id = '',
        previousId = '',
        startedAt = 0,
        expiresAt = 0,
        status = 'idle'
    }
end

local function emptyNavigation()
    return {
        active = false,
        kind = '',
        registrationId = '',
        networkId = 0,
        distance = -1,
        attempt = 0,
        startedAt = 0,
        status = 'idle'
    }
end

local function emptyResult()
    return {
        present = false,
        requestId = '',
        command = '',
        ok = false,
        code = '',
        message = '',
        registrationId = '',
        networkId = 0
    }
end

local state = {
    protocol = PROTOCOL,
    protocolVersion = PROTOCOL_VERSION,
    resource = 'ai_miner_companion',
    resourceVersion = RESOURCE_VERSION,
    epoch = 'ame_' .. randomHex(16),
    sequence = 0,
    token = 'amt_' .. randomHex(24),
    status = 'ready',
    capabilities = {
        dynamicVehicleRegistration = true,
        transactionalRegistration = true,
        registrationCommit = true,
        dynamicVehicleNavigation = true,
        workAnchor = true,
        returnToWork = true,
        cancel = true,
        cargoArrival = true,
        serverRegistrationSync = false,
        oxTarget = false,
        openCargo = cargoProviderAvailable(),
        maxVehicleDistance = math.floor(Config.Navigation.MaxVehicleDistance),
        maxTrackedVehicleSpeed = Config.Navigation.MaxTrackedVehicleSpeed
    },
    registration = emptyRegistration(),
    registrationTransaction = emptyRegistrationTransaction(),
    workAnchor = {
        set = false,
        x = 0.0,
        y = 0.0,
        z = 0.0,
        heading = 0.0,
        cameraHeading = 0.0,
        cameraPitch = 0.0
    },
    navigation = emptyNavigation(),
    lastResult = emptyResult(),
    overlay = { visible = false, title = '', detail = '', tone = 'neutral' }
}

local navigationSerial = 0
local armedSerial = 0
local internalRequestSequence = 0
local activeOperation = nil
local armedRequest = nil
local pendingRegistration = nil
local pendingRegistrationTransaction = nil
local pendingCargo = nil
local pendingClear = nil
local silentAbortRequests = {}
local committedRegistration = emptyRegistration()
local oxTargetRegistered = false
local overlaySerial = 0
local initialRegistrationSynchronized = false
local initialRegistrationSyncRequestId = ''

local function debugLog(message)
    if Config.Debug then print(('[%s] %s'):format(RESOURCE, message)) end
end

local function publishState()
    state.sequence = state.sequence + 1
    SendNUIMessage({ type = 'ai-miner-companion:state', state = state })
end

local function refreshCargoCapability(shouldPublish)
    local available = cargoProviderAvailable()
    local changed = state.capabilities.openCargo ~= available
    state.capabilities.openCargo = available
    if shouldPublish and changed then publishState() end
end

local function setOverlay(visible, title, detail, tone)
    state.overlay = {
        visible = visible == true,
        title = title or '',
        detail = detail or '',
        tone = tone or 'neutral'
    }
end

local function showToast(title, detail, tone, durationMs)
    overlaySerial = overlaySerial + 1
    local serial = overlaySerial
    setOverlay(true, title, detail, tone)
    publishState()
    CreateThread(function()
        Wait(durationMs or 3500)
        if overlaySerial == serial and not state.navigation.active and state.status ~= 'registration_armed' then
            setOverlay(false)
            publishState()
        end
    end)
end

local function beginCommand(requestId, command, status)
    overlaySerial = overlaySerial + 1
    setOverlay(false)
    state.lastResult = emptyResult()
    state.status = status or state.status
    publishState()
end

local function finishCommand(requestId, command, ok, code, message, registrationId, networkId)
    state.lastResult = {
        present = true,
        requestId = requestId or '',
        command = command or '',
        ok = ok == true,
        code = code or '',
        message = message or '',
        registrationId = registrationId or '',
        networkId = math.floor(tonumber(networkId) or 0)
    }
    publishState()
    if state.overlay.visible and state.overlay.tone ~= 'progress' then
        overlaySerial = overlaySerial + 1
        local serial = overlaySerial
        CreateThread(function()
            Wait(4000)
            if overlaySerial == serial and not state.navigation.active
                and state.status ~= 'registration_armed' and state.status ~= 'registering' then
                setOverlay(false)
                publishState()
            end
        end)
    end
end

local function failCommand(requestId, command, code, message)
    state.status = 'error'
    state.navigation = emptyNavigation()
    activeOperation = nil
    setOverlay(true, 'AI採掘機', message, 'error')
    finishCommand(requestId, command, false, code, message,
        state.registration.id, state.registration.networkId)
end

local function internalRequestId(prefix)
    internalRequestSequence = internalRequestSequence + 1
    return ('ui_%s_%d_%d'):format(prefix, GetGameTimer(), internalRequestSequence)
end

local function beginInitialRegistrationSync()
    if initialRegistrationSynchronized then return end
    if initialRegistrationSyncRequestId == '' then
        initialRegistrationSyncRequestId = internalRequestId('sync')
    end
    local requestId = initialRegistrationSyncRequestId
    local clientEpoch = state.epoch
    CreateThread(function()
        -- Reuse one request/session pair so delayed replies remain valid and a
        -- retry can never authorize commands for a newer client-resource epoch.
        while not initialRegistrationSynchronized and state.epoch == clientEpoch
            and initialRegistrationSyncRequestId == requestId do
            TriggerServerEvent('ai_miner_companion:server:getActiveRegistration',
                requestId, clientEpoch)
            Wait(3000)
        end
    end)
end

local function abortRegistrationSilently(registrationId)
    if type(registrationId) ~= 'string' or registrationId == '' then return end
    local requestId = internalRequestId('rollback')
    silentAbortRequests[requestId] = registrationId
    TriggerServerEvent('ai_miner_companion:server:abortRegistration', requestId, registrationId)
end

local function normalizeRegistration(record)
    if type(record) ~= 'table' or record.registered ~= true then
        return emptyRegistration()
    end
    return {
        registered = true,
        id = type(record.id) == 'string' and record.id or '',
        plate = type(record.plate) == 'string' and record.plate or '',
        model = math.floor(tonumber(record.model) or 0),
        label = type(record.label) == 'string' and record.label or '',
        networkId = math.floor(tonumber(record.networkId) or 0),
        lastSeen = math.floor(tonumber(record.lastSeen) or 0),
        available = record.available == true,
        availabilityCode = type(record.availabilityCode) == 'string' and record.availabilityCode or ''
    }
end

local function copyRegistration(record)
    return normalizeRegistration(record)
end

local function applyRegistration(record)
    state.registration = normalizeRegistration(record)
end

local function applyRegistrationTransaction(transaction)
    if type(transaction) ~= 'table' or transaction.pending ~= true then
        state.registrationTransaction = emptyRegistrationTransaction()
        return
    end
    state.registrationTransaction = {
        pending = true,
        id = type(transaction.id) == 'string' and transaction.id or '',
        previousId = type(transaction.previousId) == 'string' and transaction.previousId or '',
        startedAt = math.floor(tonumber(transaction.startedAt) or 0),
        expiresAt = math.floor(tonumber(transaction.expiresAt) or 0),
        status = 'staged'
    }
end

local function applyCommittedRegistration(record)
    committedRegistration = normalizeRegistration(record)
    state.registration = copyRegistration(committedRegistration)
    state.registrationTransaction = emptyRegistrationTransaction()
end

local function restoreCommittedRegistration(record)
    if record ~= nil then committedRegistration = normalizeRegistration(record) end
    state.registration = copyRegistration(committedRegistration)
    state.registrationTransaction = emptyRegistrationTransaction()
end

local function distanceBetween(a, b)
    local dx, dy, dz = a.x - b.x, a.y - b.y, a.z - b.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function roundedDistance(value)
    if type(value) ~= 'number' or value < 0 or value ~= value then return -1 end
    return math.floor(value * 100 + 0.5) / 100
end

local function manualOverrideDetected(operation)
    if GetGameTimer() - operation.startedAt < Config.Navigation.ManualOverrideGraceMs then
        return false
    end

    -- Ped tasks do not populate player control normals. Reading physical control
    -- state therefore detects user input without treating our TaskFollowNavMesh as
    -- a manual override. The threshold filters small controller-stick drift.
    local lateral = math.max(math.abs(GetControlNormal(0, 30)),
        math.abs(GetDisabledControlNormal(0, 30)))
    local forward = math.max(math.abs(GetControlNormal(0, 31)),
        math.abs(GetDisabledControlNormal(0, 31)))
    if lateral >= Config.Navigation.ManualMoveThreshold
        or forward >= Config.Navigation.ManualMoveThreshold then
        return true
    end

    for i = 1, #MANUAL_ACTION_CONTROLS do
        local control = MANUAL_ACTION_CONTROLS[i]
        if IsControlPressed(0, control) or IsDisabledControlPressed(0, control) then
            return true
        end
    end
    return false
end

local function normalizePlate(value)
    if type(value) ~= 'string' then return '' end
    return value:gsub('^%s*(.-)%s*$', '%1'):gsub('%s+', ' '):upper()
end

local function validRegistrationId(value)
    return type(value) == 'string' and #value == 40
        and value:match('^amv_[0-9a-f]+$') ~= nil
end

local function vehicleLabel(vehicle)
    local display = GetDisplayNameFromVehicleModel(GetEntityModel(vehicle))
    local label = display and GetLabelText(display) or nil
    if not label or label == '' or label == 'NULL' then return display or 'Vehicle' end
    return label
end

local function rotationToDirection(rotation)
    local z = math.rad(rotation.z)
    local x = math.rad(rotation.x)
    local multiplier = math.abs(math.cos(x))
    return vector3(-math.sin(z) * multiplier, math.cos(z) * multiplier, math.sin(x))
end

local function aimedVehicle()
    local origin = GetGameplayCamCoord()
    local direction = rotationToDirection(GetGameplayCamRot(2))
    local endpoint = origin + direction * Config.Registration.RayDistance
    local ray = StartShapeTestRay(origin.x, origin.y, origin.z, endpoint.x, endpoint.y, endpoint.z,
        2, PlayerPedId(), 7)
    local _, hit, _, _, entity = GetShapeTestResult(ray)
    if hit == 1 and entity ~= 0 and DoesEntityExist(entity) and GetEntityType(entity) == 2 then
        return entity
    end
    return nil
end

local function registrationCandidate()
    local aimed = aimedVehicle()
    if aimed then return aimed end

    local pedCoords = GetEntityCoords(PlayerPedId())
    local matches = {}
    local vehicles = GetGamePool('CVehicle')
    for i = 1, #vehicles do
        if distanceBetween(pedCoords, GetEntityCoords(vehicles[i])) <= Config.Registration.MaxDistance then
            matches[#matches + 1] = vehicles[i]
        end
    end
    if #matches == 1 then return matches[1] end
    if #matches > 1 then return nil, 'VEHICLE_SELECTION_AMBIGUOUS', '車両を画面中央に合わせてください。' end
    return nil, 'VEHICLE_NOT_AIMED', '登録する車両の近くで画面中央に合わせてください。'
end

local function requestVehicleRegistration(vehicle, requestId, command)
    if not vehicle or not DoesEntityExist(vehicle) or GetEntityType(vehicle) ~= 2 then
        failCommand(requestId, command, 'VEHICLE_INVALID', '登録する車両を確認できません。')
        return
    end
    if not NetworkGetEntityIsNetworked(vehicle) then
        failCommand(requestId, command, 'VEHICLE_NOT_NETWORKED', 'ネットワーク車両だけ登録できます。')
        return
    end
    local networkId = NetworkGetNetworkIdFromEntity(vehicle)
    if not networkId or networkId == 0 then
        failCommand(requestId, command, 'VEHICLE_NETWORK_ID_UNAVAILABLE', '車両IDを確認できません。')
        return
    end

    state.status = 'registering'
    setOverlay(true, '車両を確認中', 'サーバーで所有権を確認しています', 'progress')
    pendingRegistration = { requestId = requestId, command = command }
    publishState()
    TriggerServerEvent('ai_miner_companion:server:registerVehicle', requestId, networkId,
        vehicleLabel(vehicle))
end

local function armRegistration(requestId, command)
    armedSerial = armedSerial + 1
    local serial = armedSerial
    armedRequest = { requestId = requestId, command = command, serial = serial }
    state.status = 'registration_armed'
    setOverlay(true, '車両を登録', '車両を画面中央に合わせて E / ox_target で選択', 'progress')
    publishState()

    CreateThread(function()
        local deadline = GetGameTimer() + Config.Registration.ArmTimeoutMs
        while armedSerial == serial and state.status == 'registration_armed' do
            if IsControlJustPressed(0, 322) then
                armedRequest = nil
                state.status = 'cancelled'
                setOverlay(false)
                finishCommand(requestId, command, false, 'REGISTRATION_CANCELLED', '車両登録を中止しました。')
                return
            end
            if IsControlJustPressed(0, 38) then
                local vehicle, code, message = registrationCandidate()
                if not vehicle then
                    failCommand(requestId, command, code, message)
                    return
                end
                requestVehicleRegistration(vehicle, requestId, command)
                return
            end
            if GetGameTimer() >= deadline then
                armedRequest = nil
                failCommand(requestId, command, 'REGISTRATION_TIMEOUT', '車両登録が時間切れになりました。')
                return
            end
            Wait(0)
        end
    end)
end

local function computeRearCargoPoint(vehicle, attempt)
    local minimum = select(1, GetModelDimensions(GetEntityModel(vehicle)))
    local lateral = 0.0
    if attempt % 3 == 1 then lateral = Config.Navigation.AlternateLateralOffset end
    if attempt % 3 == 2 then lateral = -Config.Navigation.AlternateLateralOffset end
    local rearY = minimum.y - Config.Navigation.RearOffset
    local point = GetOffsetFromEntityInWorldCoords(vehicle, lateral, rearY, 0.0)
    local foundGround, groundZ = GetGroundZFor_3dCoord(point.x, point.y, point.z + 3.0, false)
    if foundGround then point = vector3(point.x, point.y, groundZ) end
    return point
end

local function alignToVehicle(vehicle)
    local ped = PlayerPedId()
    TaskTurnPedToFaceEntity(ped, vehicle, 1100)
    Wait(1150)
    if DoesEntityExist(vehicle) then
        SetGameplayCamRelativeHeading(0.0)
        SetGameplayCamRelativePitch(Config.Navigation.CameraPitch, 1.0)
    end
end

local function finishNavigationFailure(operation, code, message)
    if not activeOperation or activeOperation.serial ~= operation.serial then return end
    ClearPedTasks(PlayerPedId())
    state.navigation = emptyNavigation()
    activeOperation = nil
    failCommand(operation.requestId, operation.command, code, message)
end

local function requestArrivalAuthorization(operation)
    state.navigation.status = 'validating_arrival'
    state.status = 'navigating_vehicle'
    pendingCargo = {
        requestId = operation.requestId,
        command = operation.command,
        action = 'arrive',
        operationSerial = operation.serial
    }
    publishState()
    TriggerServerEvent('ai_miner_companion:server:authorizeCargo', operation.requestId,
        operation.registrationId, 'arrive')
end

local function runVehicleNavigation(operation)
    local streamDeadline = GetGameTimer() + Config.Navigation.StreamTimeoutMs
    local vehicle = 0
    while activeOperation and activeOperation.serial == operation.serial and GetGameTimer() < streamDeadline do
        if NetworkDoesEntityExistWithNetworkId(operation.networkId) then
            vehicle = NetworkGetEntityFromNetworkId(operation.networkId)
            if vehicle ~= 0 and DoesEntityExist(vehicle) and GetEntityType(vehicle) == 2 then break end
        end
        Wait(100)
    end
    if vehicle == 0 or not DoesEntityExist(vehicle) then
        finishNavigationFailure(operation, 'VEHICLE_UNSTREAMED', '車両が遠すぎるか読み込まれていません。')
        return
    end
    if GetEntityModel(vehicle) ~= state.registration.model
        or normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= state.registration.plate then
        finishNavigationFailure(operation, 'VEHICLE_IDENTITY_CHANGED', '登録車両との一致を確認できません。')
        return
    end

    local ped = PlayerPedId()
    local deadline = GetGameTimer() + Config.Navigation.VehicleTimeoutMs
    local lastMoveCoords = GetEntityCoords(ped)
    local lastMovedAt = GetGameTimer()
    local lastTaskAt = 0
    local lastTarget = nil
    local attempt = 0
    local vehicleOrigin = GetEntityCoords(vehicle)
    local previousVehicleCoords = vehicleOrigin

    while activeOperation and activeOperation.serial == operation.serial do
        local now = GetGameTimer()
        if now >= deadline then
            finishNavigationFailure(operation, 'NAVIGATION_TIMEOUT', '車両までの移動が時間切れになりました。')
            return
        end
        if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then
            finishNavigationFailure(operation, 'PLAYER_CANNOT_NAVIGATE', '徒歩で安全に移動できる状態ではありません。')
            return
        end
        if manualOverrideDetected(operation) then
            finishNavigationFailure(operation, 'MANUAL_OVERRIDE', '手動操作を検知したため自動移動を停止しました。')
            return
        end
        if not DoesEntityExist(vehicle) then
            finishNavigationFailure(operation, 'VEHICLE_UNSTREAMED', '移動中に車両を確認できなくなりました。')
            return
        end

        local pedCoords = GetEntityCoords(ped)
        local vehicleCoords = GetEntityCoords(vehicle)
        if GetEntitySpeed(vehicle) > Config.Navigation.MaxTrackedVehicleSpeed then
            finishNavigationFailure(operation, 'VEHICLE_MOVING_TOO_FAST', '走行中の車両は安全のため追跡しません。')
            return
        end
        if distanceBetween(vehicleCoords, previousVehicleCoords) > Config.Navigation.MaxVehicleStepDistance
            or distanceBetween(vehicleCoords, vehicleOrigin) > Config.Navigation.MaxVehicleDisplacement then
            finishNavigationFailure(operation, 'VEHICLE_MOVED_TOO_FAR', '車両が大きく移動したため追跡を停止しました。')
            return
        end
        previousVehicleCoords = vehicleCoords
        if distanceBetween(pedCoords, vehicleCoords) > Config.Navigation.MaxVehicleDistance then
            finishNavigationFailure(operation, 'VEHICLE_TOO_FAR', '車両が安全な追跡範囲から外れました。')
            return
        end

        local target = computeRearCargoPoint(vehicle, attempt)
        local targetDistance = distanceBetween(pedCoords, target)
        state.navigation.distance = roundedDistance(targetDistance)
        state.navigation.attempt = attempt
        state.navigation.status = 'moving'

        if targetDistance <= Config.Navigation.ArrivalDistance then
            ClearPedTasks(ped)
            requestArrivalAuthorization(operation)
            return
        end

        local moved = distanceBetween(pedCoords, lastMoveCoords)
        if moved >= Config.Navigation.StuckMoveDistance then
            lastMoveCoords = pedCoords
            lastMovedAt = now
        elseif now - lastMovedAt >= Config.Navigation.StuckWindowMs then
            attempt = attempt + 1
            if attempt > Config.Navigation.StuckRetries then
                finishNavigationFailure(operation, 'NAVIGATION_STUCK', '安全な荷台経路を見つけられません。')
                return
            end
            ClearPedTasks(ped)
            lastMovedAt = now
            lastTaskAt = 0
            lastTarget = nil
        end

        if now - lastTaskAt >= Config.Navigation.RetaskIntervalMs
            or not lastTarget
            or distanceBetween(target, lastTarget) >= Config.Navigation.VehicleMoveRetaskDistance then
            TaskFollowNavMeshToCoord(ped, target.x, target.y, target.z, Config.Navigation.Speed,
                -1, Config.Navigation.ArrivalDistance * 0.70, false, 0.0)
            lastTaskAt = now
            lastTarget = target
        end

        if now % 750 < 250 then publishState() end
        Wait(250)
    end
end

local function startVehicleNavigation(requestId, command, registrationId)
    if not state.registration.registered then
        failCommand(requestId, command, 'REGISTRATION_REQUIRED', '先に車両を登録してください。')
        return
    end
    registrationId = registrationId ~= '' and registrationId or state.registration.id
    if registrationId ~= state.registration.id then
        failCommand(requestId, command, 'REGISTRATION_MISMATCH', '選択中の登録車両と一致しません。')
        return
    end

    navigationSerial = navigationSerial + 1
    local operation = {
        serial = navigationSerial,
        requestId = requestId,
        command = command,
        registrationId = registrationId,
        networkId = 0,
        startedAt = GetGameTimer()
    }
    activeOperation = operation
    state.status = 'navigating_vehicle'
    state.navigation = {
        active = true,
        kind = 'vehicle',
        registrationId = registrationId,
        networkId = 0,
        distance = -1,
        attempt = 0,
        startedAt = GetGameTimer(),
        status = 'resolving'
    }
    setOverlay(true, '登録車両を検索', '現在位置をサーバーで確認しています', 'progress')
    publishState()
    TriggerServerEvent('ai_miner_companion:server:resolveVehicle', requestId, registrationId)
end

local function runReturnNavigation(operation)
    local ped = PlayerPedId()
    local destination = vector3(state.workAnchor.x, state.workAnchor.y, state.workAnchor.z)
    if distanceBetween(GetEntityCoords(ped), destination) > Config.Navigation.MaxReturnDistance then
        finishNavigationFailure(operation, 'WORK_ANCHOR_TOO_FAR', '作業地点が安全な移動範囲から外れています。')
        return
    end

    local deadline = GetGameTimer() + Config.Navigation.ReturnTimeoutMs
    local lastMoveCoords = GetEntityCoords(ped)
    local lastMovedAt = GetGameTimer()
    local lastTaskAt = 0
    local attempt = 0

    while activeOperation and activeOperation.serial == operation.serial do
        local now = GetGameTimer()
        if now >= deadline then
            finishNavigationFailure(operation, 'RETURN_TIMEOUT', '作業地点への復帰が時間切れになりました。')
            return
        end
        if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then
            finishNavigationFailure(operation, 'PLAYER_CANNOT_NAVIGATE', '徒歩で安全に移動できる状態ではありません。')
            return
        end
        if manualOverrideDetected(operation) then
            finishNavigationFailure(operation, 'MANUAL_OVERRIDE', '手動操作を検知したため自動移動を停止しました。')
            return
        end

        local pedCoords = GetEntityCoords(ped)
        local targetDistance = distanceBetween(pedCoords, destination)
        state.navigation.distance = roundedDistance(targetDistance)
        state.navigation.attempt = attempt
        state.navigation.status = 'moving'
        if targetDistance <= Config.Navigation.ArrivalDistance then
            ClearPedTasks(ped)
            SetEntityHeading(ped, state.workAnchor.heading)
            SetGameplayCamRelativeHeading(state.workAnchor.cameraHeading)
            SetGameplayCamRelativePitch(state.workAnchor.cameraPitch, 1.0)
            state.navigation = emptyNavigation()
            activeOperation = nil
            state.status = 'arrived_work'
            setOverlay(true, '作業地点へ復帰', '元の作業位置に到着しました', 'success')
            finishCommand(operation.requestId, operation.command, true, 'ARRIVED_WORK',
                '作業地点に到着しました。', state.registration.id, state.registration.networkId)
            return
        end

        local moved = distanceBetween(pedCoords, lastMoveCoords)
        if moved >= Config.Navigation.StuckMoveDistance then
            lastMoveCoords = pedCoords
            lastMovedAt = now
        elseif now - lastMovedAt >= Config.Navigation.StuckWindowMs then
            attempt = attempt + 1
            if attempt > Config.Navigation.StuckRetries then
                finishNavigationFailure(operation, 'RETURN_STUCK', '作業地点への安全な経路を見つけられません。')
                return
            end
            ClearPedTasks(ped)
            lastMovedAt = now
            lastTaskAt = 0
        end

        if now - lastTaskAt >= Config.Navigation.RetaskIntervalMs then
            TaskFollowNavMeshToCoord(ped, destination.x, destination.y, destination.z,
                Config.Navigation.Speed, -1, Config.Navigation.ArrivalDistance * 0.70, false, 0.0)
            lastTaskAt = now
        end
        if now % 750 < 250 then publishState() end
        Wait(250)
    end
end

local function startReturnNavigation(requestId, command)
    if not state.workAnchor.set then
        failCommand(requestId, command, 'WORK_ANCHOR_REQUIRED', '先に作業地点を記録してください。')
        return
    end
    navigationSerial = navigationSerial + 1
    local operation = {
        serial = navigationSerial,
        requestId = requestId,
        command = command,
        startedAt = GetGameTimer()
    }
    activeOperation = operation
    state.status = 'returning_work'
    state.navigation = {
        active = true,
        kind = 'work',
        registrationId = state.registration.id,
        networkId = 0,
        distance = -1,
        attempt = 0,
        startedAt = GetGameTimer(),
        status = 'moving'
    }
    setOverlay(true, '作業地点へ復帰', '安全な徒歩経路を計算しています', 'progress')
    publishState()
    CreateThread(function() runReturnNavigation(operation) end)
end

local function cancelAll(requestId, command)
    if state.registrationTransaction.pending then
        abortRegistrationSilently(state.registrationTransaction.id)
    end
    navigationSerial = navigationSerial + 1
    armedSerial = armedSerial + 1
    activeOperation = nil
    armedRequest = nil
    pendingRegistration = nil
    pendingRegistrationTransaction = nil
    pendingCargo = nil
    pendingClear = nil
    ClearPedTasks(PlayerPedId())
    state.navigation = emptyNavigation()
    state.status = 'cancelled'
    setOverlay(false)
    finishCommand(requestId, command, true, 'CANCELLED', '操作を中止しました。',
        state.registration.id, state.registration.networkId)
end

local function openCargo(requestId, command, registrationId)
    if not state.registration.registered then
        failCommand(requestId, command, 'REGISTRATION_REQUIRED', '先に車両を登録してください。')
        return
    end
    registrationId = registrationId ~= '' and registrationId or state.registration.id
    if registrationId ~= state.registration.id then
        failCommand(requestId, command, 'REGISTRATION_MISMATCH', '選択中の登録車両と一致しません。')
        return
    end

    local vehicle = state.registration.networkId > 0
        and NetworkGetEntityFromNetworkId(state.registration.networkId) or 0
    if vehicle == 0 or not DoesEntityExist(vehicle) then
        failCommand(requestId, command, 'VEHICLE_UNSTREAMED', '荷台を開く前に車両まで移動してください。')
        return
    end
    local rearPoint = computeRearCargoPoint(vehicle, 0)
    if distanceBetween(GetEntityCoords(PlayerPedId()), rearPoint) > Config.Cargo.ServerOpenDistance then
        failCommand(requestId, command, 'NOT_AT_CARGO', '登録車両の荷台まで移動してください。')
        return
    end

    state.status = 'opening_cargo'
    pendingCargo = {
        requestId = requestId,
        command = command,
        action = 'open',
        operationSerial = navigationSerial
    }
    setOverlay(true, '荷台を確認', '登録車両との一致を再確認しています', 'progress')
    publishState()
    TriggerServerEvent('ai_miner_companion:server:authorizeCargo', requestId, registrationId, 'open')
end

local function dispatchCommand(requestId, command, argument)
    beginCommand(requestId, command, state.status)

    -- The NUI frame is visible before the server has restored (and, when
    -- necessary, rolled back) this identity's durable registration. Mutating in
    -- that window could stage a candidate that the startup sync then aborts.
    -- Read-only probes and cancel remain available; every other command fails
    -- closed until the matching server/session response has been applied.
    if not initialRegistrationSynchronized and command ~= 'capabilities'
        and command ~= 'status' and command ~= 'cancel' then
        failCommand(requestId, command, 'SERVER_REGISTRATION_SYNC_PENDING',
            'サーバーの車両登録を同期中です。数秒待ってから再試行してください。')
        return
    end

    local transactionCommand = command == 'commit-registration' or command == 'abort-registration'
    local transactionArgument = argument ~= '' and argument or state.registrationTransaction.id
    local transactionRetry = transactionCommand and state.status == 'registering'
        and state.registrationTransaction.pending and transactionArgument == state.registrationTransaction.id
        and pendingRegistrationTransaction ~= nil
    if command ~= 'cancel' and not transactionRetry
        and (state.navigation.active or state.status == 'registering'
            or state.status == 'registration_armed' or state.status == 'opening_cargo') then
        finishCommand(requestId, command, false, 'BUSY', '別の操作を実行中です。',
            state.registration.id, state.registration.networkId)
        return
    end

    if (command == 'arm-register' or command == 'register-nearby')
        and state.registrationTransaction.pending then
        failCommand(requestId, command, 'REGISTRATION_TRANSACTION_PENDING',
            '現在の仮登録を確定または取り消してから別の車両を選んでください。')
    elseif command == 'capabilities' or command == 'status' then
        finishCommand(requestId, command, true, 'OK', '状態を取得しました。',
            state.registration.id, state.registration.networkId)
    elseif command == 'arm-register' then
        armRegistration(requestId, command)
    elseif command == 'register-nearby' then
        local vehicle, code, message = registrationCandidate()
        if not vehicle then failCommand(requestId, command, code, message) return end
        requestVehicleRegistration(vehicle, requestId, command)
    elseif command == 'commit-registration' or command == 'abort-registration' then
        local id = argument ~= '' and argument or state.registrationTransaction.id
        if not validRegistrationId(id) then
            failCommand(requestId, command, 'REGISTRATION_ID_INVALID', '車両登録IDの形式が正しくありません。')
            return
        end
        if state.registrationTransaction.pending
            and (id ~= state.registrationTransaction.id or id ~= state.registration.id) then
            failCommand(requestId, command, 'REGISTRATION_TRANSACTION_NOT_FOUND',
                '確定または取り消しできる車両候補がありません。')
            return
        end
        local action = command == 'commit-registration' and 'commit' or 'abort'
        pendingRegistrationTransaction = {
            requestId = requestId,
            command = command,
            action = action,
            registrationId = id
        }
        state.status = 'registering'
        setOverlay(true, action == 'commit' and '車両登録を確定' or '仮登録を取り消し',
            action == 'commit' and '所有権と荷台位置を再確認しています'
                or '以前の車両登録へ戻しています', 'progress')
        publishState()
        if action == 'commit' then
            TriggerServerEvent('ai_miner_companion:server:commitRegistration', requestId, id)
        else
            TriggerServerEvent('ai_miner_companion:server:abortRegistration', requestId, id)
        end
    elseif command == 'clear-registration' then
        if state.registrationTransaction.pending then
            failCommand(requestId, command, 'REGISTRATION_TRANSACTION_PENDING',
                '仮登録を確定または取り消してから登録を削除してください。')
            return
        end
        local id = argument ~= '' and argument or state.registration.id
        if not state.registration.registered or id ~= state.registration.id then
            failCommand(requestId, command, 'REGISTRATION_NOT_FOUND', '削除できる車両登録がありません。')
            return
        end
        pendingClear = { requestId = requestId, command = command }
        state.status = 'registering'
        publishState()
        TriggerServerEvent('ai_miner_companion:server:clearRegistration', requestId, id)
    elseif command == 'set-work-anchor' then
        local ped = PlayerPedId()
        if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then
            failCommand(requestId, command, 'WORK_ANCHOR_UNSAFE', '徒歩で停止してから作業地点を記録してください。')
            return
        end
        local coords = GetEntityCoords(ped)
        state.workAnchor = {
            set = true,
            x = coords.x,
            y = coords.y,
            z = coords.z,
            heading = GetEntityHeading(ped),
            cameraHeading = GetGameplayCamRelativeHeading(),
            cameraPitch = GetGameplayCamRelativePitch()
        }
        state.status = 'ready'
        setOverlay(true, '作業地点を記録', '収納後はこの位置へ戻ります', 'success')
        finishCommand(requestId, command, true, 'WORK_ANCHOR_SET', '作業地点を記録しました。',
            state.registration.id, state.registration.networkId)
    elseif command == 'go-vehicle' then
        startVehicleNavigation(requestId, command, argument or '')
    elseif command == 'open-cargo' then
        openCargo(requestId, command, argument or '')
    elseif command == 'return-work' then
        startReturnNavigation(requestId, command)
    elseif command == 'cancel' then
        cancelAll(requestId, command)
    else
        failCommand(requestId, command, 'UNKNOWN_COMMAND', '未対応のコマンドです。')
    end
end

RegisterCommand(Config.Commands.Bridge, function(_, args)
    local token, requestId, command = args[1] or '', args[2] or '', args[3] or ''
    local argument = args[4] or ''
    if token ~= state.token then return end
    if not requestId:match('^[A-Za-z0-9_-]+$') or #requestId > 64 then return end
    dispatchCommand(requestId, command:lower(), argument)
end, false)

RegisterCommand(Config.Commands.RegisterFallback, function()
    if state.status ~= 'registration_armed' or not armedRequest then
        showToast('車両登録', '先にデスクトップアプリで登録待機を開始してください', 'error', 3500)
        return
    end
    local request = armedRequest
    armedRequest = nil
    local vehicle, code, message = registrationCandidate()
    if not vehicle then
        failCommand(request.requestId, request.command, code, message)
        return
    end
    requestVehicleRegistration(vehicle, request.requestId, request.command)
end, false)

RegisterCommand(Config.Commands.CancelFallback, function()
    local requestId = internalRequestId('cancel')
    beginCommand(requestId, 'cancel', state.status)
    cancelAll(requestId, 'cancel')
end, false)

RegisterNetEvent('ai_miner_companion:client:activeRegistration',
    function(requestId, clientEpoch, ok, code, record)
    if initialRegistrationSynchronized
        or requestId ~= initialRegistrationSyncRequestId
        or clientEpoch ~= state.epoch then return end
    if ok ~= true then
        state.capabilities.serverRegistrationSync = false
        state.status = 'error'
        finishCommand(requestId, 'status', false,
            type(code) == 'string' and code or 'SERVER_REGISTRATION_SYNC_FAILED',
            'サーバーのプレイヤー識別子を確認できません。同期を再試行します。', '', 0)
        return
    end
    initialRegistrationSynchronized = true
    state.capabilities.serverRegistrationSync = true
    applyCommittedRegistration(record)
    state.status = 'ready'
    setOverlay(false)
    if state.lastResult.present and state.lastResult.requestId == requestId
        and state.lastResult.command == 'status' then
        state.lastResult = emptyResult()
    end
    publishState()
end)

RegisterNetEvent('ai_miner_companion:client:registrationResult',
    function(requestId, ok, code, message, record, previousRecord, transaction)
    if not pendingRegistration or pendingRegistration.requestId ~= requestId then
        -- A selection can finish just after cancel. Never leave that orphaned
        -- candidate alive on the server; roll it back without replacing CANCELLED.
        if ok and type(record) == 'table' and type(record.id) == 'string' then
            abortRegistrationSilently(record.id)
        end
        return
    end
    local command = pendingRegistration.command
    pendingRegistration = nil
    armedRequest = nil
    armedSerial = armedSerial + 1
    if not ok then failCommand(requestId, command, code, message) return end
    committedRegistration = normalizeRegistration(previousRecord)
    applyRegistration(record)
    applyRegistrationTransaction(transaction)
    state.status = 'ready'
    setOverlay(true, '車両候補を確認', ('%s / %s ・ 荷台確認待ち'):format(
        state.registration.label, state.registration.plate), 'success')
    finishCommand(requestId, command, true, code, message,
        state.registration.id, state.registration.networkId)
end)

RegisterNetEvent('ai_miner_companion:client:commitRegistrationResult',
    function(requestId, ok, code, message, record)
        local pending = pendingRegistrationTransaction
        if not pending or pending.requestId ~= requestId or pending.action ~= 'commit' then return end
        pendingRegistrationTransaction = nil
        if not ok then
            -- Server commit validation failures are terminal and already rolled
            -- back. A RATE_LIMITED response is the only retryable exception.
            if code ~= 'RATE_LIMITED' then restoreCommittedRegistration(record) end
            failCommand(requestId, pending.command, code, message)
            return
        end
        applyCommittedRegistration(record)
        state.status = 'ready'
        setOverlay(true, '車両登録を確定', message, 'success')
        finishCommand(requestId, pending.command, true, code, message,
            state.registration.id, state.registration.networkId)
    end)

RegisterNetEvent('ai_miner_companion:client:abortRegistrationResult',
    function(requestId, ok, code, message, record)
        if silentAbortRequests[requestId] then
            local abortedRegistrationId = silentAbortRequests[requestId]
            silentAbortRequests[requestId] = nil
            if ok or code == 'REGISTRATION_TRANSACTION_NOT_FOUND'
                or code == 'REGISTRATION_TRANSACTION_EXPIRED' then
                if state.registrationTransaction.pending
                    and state.registrationTransaction.id ~= abortedRegistrationId then return end
                restoreCommittedRegistration(record)
                publishState()
            end
            return
        end

        local pending = pendingRegistrationTransaction
        if not pending or pending.requestId ~= requestId or pending.action ~= 'abort' then return end
        pendingRegistrationTransaction = nil
        if not ok then
            if code ~= 'RATE_LIMITED' then restoreCommittedRegistration(record) end
            failCommand(requestId, pending.command, code, message)
            return
        end
        restoreCommittedRegistration(record)
        state.status = 'ready'
        setOverlay(true, '仮登録を取り消し', message, 'success')
        finishCommand(requestId, pending.command, true, code, message,
            state.registration.id, state.registration.networkId)
    end)

RegisterNetEvent('ai_miner_companion:client:registrationTransactionExpired',
    function(registrationId, record)
        if not state.registrationTransaction.pending
            or state.registrationTransaction.id ~= registrationId then return end
        restoreCommittedRegistration(record)
        pendingRegistrationTransaction = nil

        local operation = activeOperation
        if operation and operation.registrationId == registrationId then
            finishNavigationFailure(operation, 'REGISTRATION_TRANSACTION_EXPIRED',
                '仮登録の有効時間が切れたため、以前の登録へ戻しました。')
            return
        end

        state.status = 'error'
        setOverlay(true, '仮登録の期限切れ', '以前の車両登録へ戻しました', 'error')
        finishCommand(internalRequestId('expired'), 'registration-transaction', false,
            'REGISTRATION_TRANSACTION_EXPIRED', '仮登録の有効時間が切れました。',
            state.registration.id, state.registration.networkId)
    end)

RegisterNetEvent('ai_miner_companion:client:resolveResult', function(requestId, ok, code, message, record)
    local operation = activeOperation
    if not operation or operation.requestId ~= requestId or operation.command ~= 'go-vehicle' then return end
    if code == 'REGISTRATION_TRANSACTION_EXPIRED' then restoreCommittedRegistration(nil) end
    if type(record) == 'table' then applyRegistration(record) end
    if not ok then finishNavigationFailure(operation, code, message) return end
    operation.networkId = state.registration.networkId
    state.navigation.networkId = operation.networkId
    state.navigation.status = 'streaming'
    publishState()
    CreateThread(function() runVehicleNavigation(operation) end)
end)

RegisterNetEvent('ai_miner_companion:client:cargoAuthorization',
    function(requestId, action, ok, code, message, record)
        if not pendingCargo or pendingCargo.requestId ~= requestId or pendingCargo.action ~= action then return end
        local pending = pendingCargo
        pendingCargo = nil
        if code == 'REGISTRATION_TRANSACTION_EXPIRED' then restoreCommittedRegistration(nil) end
        if type(record) == 'table' then applyRegistration(record) end

        if action == 'arrive' then
            local operation = activeOperation
            if not operation or operation.serial ~= pending.operationSerial then return end
            if not ok then finishNavigationFailure(operation, code, message) return end
            local vehicle = state.registration.networkId > 0
                and NetworkGetEntityFromNetworkId(state.registration.networkId) or 0
            if vehicle == 0 or not DoesEntityExist(vehicle) then
                finishNavigationFailure(operation, 'VEHICLE_UNSTREAMED', '到着確認中に車両を見失いました。')
                return
            end
            local rearDistance = distanceBetween(GetEntityCoords(PlayerPedId()), computeRearCargoPoint(vehicle, 0))
            if rearDistance > Config.Cargo.ServerOpenDistance then
                finishNavigationFailure(operation, 'VEHICLE_MOVED_AFTER_ARRIVAL', '到着確認中に車両が移動しました。')
                return
            end
            alignToVehicle(vehicle)
            if not activeOperation or activeOperation.serial ~= operation.serial then return end
            state.navigation = emptyNavigation()
            activeOperation = nil
            state.status = 'arrived_vehicle'
            setOverlay(true, '荷台に到着', '登録車両の荷台を確認しました', 'success')
            finishCommand(requestId, pending.command, true, 'ARRIVED_VEHICLE', '登録車両の荷台に到着しました。',
                state.registration.id, state.registration.networkId)
            return
        end

        if not ok then failCommand(requestId, pending.command, code, message) return end
        local vehicle = state.registration.networkId > 0
            and NetworkGetEntityFromNetworkId(state.registration.networkId) or 0
        if vehicle == 0 or not DoesEntityExist(vehicle) then
            failCommand(requestId, pending.command, 'VEHICLE_UNSTREAMED', '登録車両を確認できません。')
            return
        end
        alignToVehicle(vehicle)
        if navigationSerial ~= pending.operationSerial then return end

        local resultCode = 'CARGO_READY'
        local resultMessage = '登録車両の荷台で通常の操作を実行できます。'
        if Config.Cargo.Mode == 'ox_inventory' then
            refreshCargoCapability(false)
            if not state.capabilities.openCargo then
                failCommand(requestId, pending.command, 'CARGO_PROVIDER_UNAVAILABLE',
                    'ox_inventoryが起動していないため荷台を開けません。')
                return
            end

            local callOk, openResult = pcall(function()
                return exports.ox_inventory:openInventory('trunk', {
                    netid = state.registration.networkId
                })
            end)
            if not callOk then
                debugLog(('ox_inventory openInventory error: %s'):format(tostring(openResult)))
                state.capabilities.openCargo = false
                failCommand(requestId, pending.command, 'CARGO_OPEN_ERROR',
                    'ox_inventoryの荷台を開けませんでした。')
                return
            end

            if openResult ~= true then
                Wait(250)
                local stateOk, inventoryOpen = pcall(function()
                    return LocalPlayer.state.invOpen == true
                end)
                if not stateOk or inventoryOpen ~= true then
                    failCommand(requestId, pending.command, 'CARGO_OPEN_REJECTED',
                        '荷台がロック中、使用中、または開けない状態です。')
                    return
                end
            end
            resultCode = 'CARGO_OPENED'
            resultMessage = '登録車両の荷台を開きました。'
        elseif Config.Cargo.Mode == 'client_event' and Config.Cargo.ClientEvent ~= '' then
            TriggerEvent(Config.Cargo.ClientEvent, vehicle, {
                registrationId = state.registration.id,
                plate = state.registration.plate,
                model = state.registration.model,
                networkId = state.registration.networkId
            })
            resultCode = 'CARGO_OPEN_REQUESTED'
            resultMessage = '荷台アダプターを呼び出しました。'
        elseif Config.Cargo.Mode == 'server_event' and Config.Cargo.ServerEvent ~= '' then
            resultCode = 'CARGO_OPEN_REQUESTED'
            resultMessage = 'サーバーの荷台アダプターを呼び出しました。'
        end
        state.status = 'arrived_vehicle'
        setOverlay(true, '荷台を確認', resultMessage, 'success')
        finishCommand(requestId, pending.command, true, resultCode, resultMessage,
            state.registration.id, state.registration.networkId)
    end)

RegisterNetEvent('ai_miner_companion:client:clearRegistrationResult',
    function(requestId, ok, code, message)
        if not pendingClear or pendingClear.requestId ~= requestId then return end
        local command = pendingClear.command
        pendingClear = nil
        if not ok then failCommand(requestId, command, code, message) return end
        applyCommittedRegistration(nil)
        state.status = 'ready'
        setOverlay(true, '車両登録を削除', message, 'success')
        finishCommand(requestId, command, true, code, message, '', 0)
    end)

local function addOxTargetOption()
    if oxTargetRegistered or not Config.OxTarget.Enabled or GetResourceState('ox_target') ~= 'started' then
        return
    end
    local ok = pcall(function()
        exports.ox_target:addGlobalVehicle({
            {
                name = Config.OxTarget.OptionName,
                icon = Config.OxTarget.Icon,
                label = Config.OxTarget.Label,
                distance = Config.Registration.TargetDistance,
                canInteract = function(entity)
                    return state.status == 'registration_armed' and armedRequest ~= nil
                        and entity ~= 0 and DoesEntityExist(entity) and NetworkGetEntityIsNetworked(entity)
                end,
                onSelect = function(data)
                    if state.navigation.active or state.status == 'registering'
                        or state.status == 'opening_cargo' then return end
                    if state.status == 'registration_armed' and armedRequest then
                        local request = armedRequest
                        armedRequest = nil
                        requestVehicleRegistration(data.entity, request.requestId, request.command)
                    end
                end
            }
        })
    end)
    oxTargetRegistered = ok
    state.capabilities.oxTarget = ok
    publishState()
end

local function removeOxTargetOption()
    if not oxTargetRegistered or GetResourceState('ox_target') ~= 'started' then return end
    pcall(function() exports.ox_target:removeGlobalVehicle(Config.OxTarget.OptionName) end)
    oxTargetRegistered = false
    state.capabilities.oxTarget = false
end

RegisterNUICallback('ready', function(_, callback)
    publishState()
    callback({ ok = true })
end)

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName == RESOURCE then
        CreateThread(function()
            Wait(500)
            refreshCargoCapability(false)
            addOxTargetOption()
            beginInitialRegistrationSync()
            publishState()
        end)
    elseif resourceName == 'ox_target' then
        CreateThread(function() Wait(250) addOxTargetOption() end)
    elseif resourceName == 'ox_inventory' then
        CreateThread(function()
            Wait(250)
            refreshCargoCapability(true)
        end)
    end
end)

AddEventHandler('onClientResourceStop', function(resourceName)
    if resourceName == 'ox_target' then
        oxTargetRegistered = false
        state.capabilities.oxTarget = false
        publishState()
    elseif resourceName == 'ox_inventory' then
        if Config.Cargo.Mode == 'ox_inventory' and state.capabilities.openCargo then
            state.capabilities.openCargo = false
            publishState()
        end
    elseif resourceName == RESOURCE then
        navigationSerial = navigationSerial + 1
        armedSerial = armedSerial + 1
        ClearPedTasks(PlayerPedId())
        removeOxTargetOption()
    end
end)
