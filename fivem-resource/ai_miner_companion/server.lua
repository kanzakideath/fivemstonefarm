local RESOURCE = GetCurrentResourceName()
local registrationsById = {}
local registrationByBinding = {}
local activeRegistrationByIdentity = {}
local pendingRegistrationByIdentity = {}
local pendingRegistrationById = {}
local abortedRegistrationReceiptsById = {}
local rateLimitBySource = {}
local synchronizedClientEpochBySource = {}

math.randomseed(os.time() + GetGameTimer())
for _ = 1, 8 do math.random() end

local function debugLog(message)
    if Config.Debug then
        print(('[%s] %s'):format(RESOURCE, message))
    end
end

local function randomHex(byteCount)
    local parts = {}
    for i = 1, byteCount do
        parts[i] = ('%02x'):format(math.random(0, 255))
    end
    return table.concat(parts)
end

local function normalizePlate(value)
    if type(value) ~= 'string' then return nil end
    local normalized = value:gsub('^%s*(.-)%s*$', '%1'):gsub('%s+', ' '):upper()
    if normalized == '' or #normalized > 16 then return nil end
    return normalized
end

local function sanitizeLabel(value, model)
    if type(value) ~= 'string' then return ('Vehicle %s'):format(model) end
    local label = value:gsub('[%c]', ''):sub(1, 48)
    if label == '' or label == 'NULL' then return ('Vehicle %s'):format(model) end
    return label
end

local function distanceBetween(a, b)
    local dx, dy, dz = a.x - b.x, a.y - b.y, a.z - b.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function getIdentity(source)
    if type(ServerConfig.IdentityProvider) ~= 'function' then return nil end
    local ok, identity = pcall(ServerConfig.IdentityProvider, source)
    if not ok or type(identity) ~= 'string' or identity == '' then return nil end
    return identity
end

local function isRateLimited(source, bucket, intervalMs)
    local now = GetGameTimer()
    local buckets = rateLimitBySource[source]
    if not buckets then
        buckets = {}
        rateLimitBySource[source] = buckets
    end
    local previous = buckets[bucket]
    if previous and now - previous < intervalMs then return true end
    buckets[bucket] = now
    return false
end

local function validRequestId(requestId)
    return type(requestId) == 'string' and #requestId >= 1 and #requestId <= 64
        and requestId:match('^[A-Za-z0-9_-]+$') ~= nil
end

local function validRegistrationId(registrationId)
    return type(registrationId) == 'string' and #registrationId == 40
        and registrationId:match('^amv_[0-9a-f]+$') ~= nil
end

local function validClientEpoch(clientEpoch)
    return type(clientEpoch) == 'string' and #clientEpoch == 36
        and clientEpoch:match('^ame_[0-9a-f]+$') ~= nil
end

local function getVehicleFromNetworkId(networkId)
    networkId = tonumber(networkId)
    if not networkId or networkId < 1 then return nil end
    local entity = NetworkGetEntityFromNetworkId(math.floor(networkId))
    if entity == 0 or not DoesEntityExist(entity) or GetEntityType(entity) ~= 2 then return nil end
    return entity
end

local function playerDistanceToEntity(source, entity)
    local ped = GetPlayerPed(source)
    if ped == 0 or not DoesEntityExist(ped) then return nil end
    return distanceBetween(GetEntityCoords(ped), GetEntityCoords(entity))
end

local function ownershipAllowed(source, vehicle, identity, plate, model)
    local context = {
        ownerIdentifier = identity,
        plate = plate,
        model = model,
        networkId = NetworkGetNetworkIdFromEntity(vehicle)
    }

    local ownership = ServerConfig.Ownership or {}
    local mode = ownership.Mode or 'hook'
    if mode == 'allow_all' then
        return true, nil, context
    end

    if mode == 'ace' then
        local permission = ownership.AcePermission or 'ai_miner.vehicle.register'
        return IsPlayerAceAllowed(source, permission), 'OWNERSHIP_ACE_DENIED', context
    end

    if mode ~= 'hook' or type(ownership.Validator) ~= 'function' then
        return false, 'OWNERSHIP_ADAPTER_NOT_CONFIGURED', context
    end

    local ok, allowed, reason = pcall(ownership.Validator, source, vehicle, context)
    if not ok then
        print(('[%s] ownership validator error: %s'):format(RESOURCE, tostring(allowed)))
        return false, 'OWNERSHIP_VALIDATOR_ERROR', context
    end
    if allowed ~= true then
        return false, reason or 'VEHICLE_NOT_OWNED', context
    end
    return true, nil, context
end

local function setRegistrationState(entity, registrationId)
    pcall(function()
        Entity(entity).state:set('aiMinerRegistrationId', registrationId, true)
    end)
end

local function publicRecord(record)
    return {
        registered = true,
        id = record.id,
        plate = record.plate,
        model = record.model,
        label = record.label,
        networkId = record.networkId,
        lastSeen = record.lastSeen,
        available = record.available == true,
        availabilityCode = record.availabilityCode or '',
        pending = record.pending == true,
        previousId = record.previousId or ''
    }
end

local function publicTransaction(record)
    if not record then
        return {
            pending = false,
            id = '',
            previousId = '',
            startedAt = 0,
            expiresAt = 0,
            status = 'idle'
        }
    end
    return {
        pending = true,
        id = record.id,
        previousId = record.previousId or '',
        startedAt = math.floor(tonumber(record.transactionStartedAt) or 0),
        expiresAt = math.floor(tonumber(record.transactionExpiresAt) or 0),
        status = 'staged'
    }
end

local function clearRegistrationState(record, replacement)
    if not record then return end
    local vehicle = getVehicleFromNetworkId(record.networkId)
    if not vehicle then return end
    pcall(function()
        if Entity(vehicle).state.aiMinerRegistrationId ~= record.id then return end
        local replacementId = nil
        if replacement then
            local replacementVehicle = getVehicleFromNetworkId(replacement.networkId)
            if replacementVehicle == vehicle
                or (replacementVehicle == nil and replacement.plate == record.plate
                    and replacement.model == record.model) then
                replacementId = replacement.id
            end
        end
        Entity(vehicle).state:set('aiMinerRegistrationId', replacementId, true)
    end)
end

local function identityKvpKey(identity)
    local encoded = {}
    for i = 1, #identity do
        encoded[i] = ('%02x'):format(identity:byte(i))
    end
    return 'active:' .. table.concat(encoded)
end

local function persistRecord(record)
    SetResourceKvp(identityKvpKey(record.identity), json.encode({
        id = record.id,
        plate = record.plate,
        model = record.model,
        label = record.label,
        createdAt = record.createdAt,
        lastSeen = record.lastSeen
    }))
end


local function loadPersistedRecord(identity)
    local activeId = activeRegistrationByIdentity[identity]
    if activeId and registrationsById[activeId] then return registrationsById[activeId] end

    local encoded = GetResourceKvpString(identityKvpKey(identity))
    if not encoded or encoded == '' then return nil end
    local ok, data = pcall(json.decode, encoded)
    if not ok or type(data) ~= 'table'
        or not validRegistrationId(data.id)
        or type(data.plate) ~= 'string' or normalizePlate(data.plate) ~= data.plate
        or type(data.model) ~= 'number' or data.model == 0 then
        DeleteResourceKvp(identityKvpKey(identity))
        return nil
    end

    local record = {
        id = data.id,
        identity = identity,
        plate = data.plate,
        model = math.floor(data.model),
        label = sanitizeLabel(data.label, data.model),
        networkId = 0,
        createdAt = tonumber(data.createdAt) or os.time(),
        lastSeen = tonumber(data.lastSeen) or 0,
        available = false,
        availabilityCode = 'NOT_RESOLVED'
    }
    local binding = identity .. '\0' .. record.plate .. '\0' .. tostring(record.model)
    registrationsById[record.id] = record
    registrationByBinding[binding] = record.id
    activeRegistrationByIdentity[identity] = record.id
    return record
end

local function committedRecord(identity)
    return identity and loadPersistedRecord(identity) or nil
end

local function pendingExpired(record)
    return record and os.time() >= (tonumber(record.transactionExpiresAt) or 0)
end

local function abortPendingRegistration(identity)
    local pending = pendingRegistrationByIdentity[identity]
    local previous = committedRecord(identity)
    if not pending then return nil, previous end

    pendingRegistrationByIdentity[identity] = nil
    pendingRegistrationById[pending.id] = nil
    abortedRegistrationReceiptsById[pending.id] = {
        identity = identity,
        source = pending.source,
        expiresAt = os.time() + math.max(1,
            math.floor((tonumber(Config.Registration.TransactionReceiptMs) or 60000) / 1000))
    }
    clearRegistrationState(pending, previous)
    debugLog(('aborted staged registration %s for %s'):format(pending.id, identity))
    return pending, previous
end

local function expirePendingRegistration(identity, record)
    if not record or pendingRegistrationByIdentity[identity] ~= record then
        return nil
    end
    local sourceId = record.source
    local expired, previous = abortPendingRegistration(identity)
    if expired and sourceId and getIdentity(sourceId) == identity then
        TriggerClientEvent('ai_miner_companion:client:registrationTransactionExpired', sourceId,
            expired.id, previous and publicRecord(previous) or nil)
    end
    return previous
end

local function resolveRecord(source, registrationId, maximumDistance)
    local identity = getIdentity(source)
    if not identity then return nil, nil, 'PLAYER_IDENTITY_UNAVAILABLE' end

    local requestedId = tostring(registrationId or '')
    local record = registrationsById[requestedId]
    if not record then
        local persisted = loadPersistedRecord(identity)
        if persisted and persisted.id == requestedId then record = persisted end
    end
    if not record then
        local pending = pendingRegistrationById[requestedId]
        if pending and pending.identity == identity then
            if pendingExpired(pending) then
                expirePendingRegistration(identity, pending)
                return nil, nil, 'REGISTRATION_TRANSACTION_EXPIRED'
            end
            record = pending
        end
    end
    if not record or record.identity ~= identity then
        return nil, nil, 'REGISTRATION_NOT_FOUND'
    end

    local vehicle = getVehicleFromNetworkId(record.networkId)
    if vehicle then
        local plate = normalizePlate(GetVehicleNumberPlateText(vehicle))
        if GetEntityModel(vehicle) ~= record.model or plate ~= record.plate then
            vehicle = nil
        end
    end

    if not vehicle then
        local markedMatches, exactMatches = {}, {}
        local vehicles = GetAllVehicles()
        for i = 1, #vehicles do
            local candidate = vehicles[i]
            if DoesEntityExist(candidate)
                and GetEntityModel(candidate) == record.model
                and normalizePlate(GetVehicleNumberPlateText(candidate)) == record.plate then
                exactMatches[#exactMatches + 1] = candidate
                local ok, stateId = pcall(function()
                    return Entity(candidate).state.aiMinerRegistrationId
                end)
                if ok and stateId == record.id then
                    markedMatches[#markedMatches + 1] = candidate
                end
            end
        end

        if #markedMatches == 1 then
            vehicle = markedMatches[1]
        elseif #markedMatches > 1 or #exactMatches > 1 then
            record.available = false
            record.availabilityCode = 'VEHICLE_MATCH_AMBIGUOUS'
            return nil, record, 'VEHICLE_MATCH_AMBIGUOUS'
        elseif #exactMatches == 1 then
            vehicle = exactMatches[1]
        end
    end

    if not vehicle then
        record.available = false
        record.availabilityCode = 'VEHICLE_UNAVAILABLE'
        return nil, record, 'VEHICLE_UNAVAILABLE'
    end

    local distance = playerDistanceToEntity(source, vehicle)
    if not distance then
        record.available = false
        record.availabilityCode = 'PLAYER_UNAVAILABLE'
        return nil, record, 'PLAYER_UNAVAILABLE'
    end
    if distance > maximumDistance then
        record.available = false
        record.availabilityCode = 'VEHICLE_TOO_FAR'
        return nil, record, 'VEHICLE_TOO_FAR'
    end

    local allowed, reason = ownershipAllowed(source, vehicle, identity, record.plate, record.model)
    if not allowed then
        record.available = false
        record.availabilityCode = reason or 'VEHICLE_NOT_OWNED'
        return nil, record, reason
    end

    record.networkId = NetworkGetNetworkIdFromEntity(vehicle)
    record.lastSeen = os.time()
    record.available = true
    record.availabilityCode = ''
    setRegistrationState(vehicle, record.id)
    if record.pending ~= true then persistRecord(record) end
    return vehicle, record, nil, distance
end

RegisterNetEvent('ai_miner_companion:server:getActiveRegistration', function(requestId, clientEpoch)
    local source = source
    if not validRequestId(requestId) or not validClientEpoch(clientEpoch) then return end
    local identity = getIdentity(source)
    if not identity then
        TriggerClientEvent('ai_miner_companion:client:activeRegistration', source,
            requestId, clientEpoch, false, 'PLAYER_IDENTITY_UNAVAILABLE')
        return
    end

    -- Retries for one client-resource epoch are idempotent. In particular, a
    -- delayed duplicate must never abort a candidate staged after the first
    -- successful synchronization response.
    if synchronizedClientEpochBySource[source] ~= clientEpoch then
        abortPendingRegistration(identity)
        synchronizedClientEpochBySource[source] = clientEpoch
    end
    local record = loadPersistedRecord(identity)
    TriggerClientEvent('ai_miner_companion:client:activeRegistration', source,
        requestId, clientEpoch, true, 'SERVER_REGISTRATION_SYNCED',
        record and publicRecord(record) or nil)
end)

RegisterNetEvent('ai_miner_companion:server:registerVehicle', function(requestId, networkId, clientLabel)
    local source = source
    if not validRequestId(requestId) then return end
    if isRateLimited(source, 'register', 500) then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    local identity = getIdentity(source)
    if not identity then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            'PLAYER_IDENTITY_UNAVAILABLE', 'プレイヤー識別子を確認できません。')
        return
    end

    loadPersistedRecord(identity)

    local vehicle = getVehicleFromNetworkId(networkId)
    if not vehicle then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            'VEHICLE_INVALID', 'ネットワーク車両を確認できません。')
        return
    end

    local distance = playerDistanceToEntity(source, vehicle)
    if not distance or distance > Config.Registration.MaxDistance then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            'VEHICLE_TOO_FAR', '車両の近くで登録してください。')
        return
    end

    local plate = normalizePlate(GetVehicleNumberPlateText(vehicle))
    local model = GetEntityModel(vehicle)
    if not plate or not model or model == 0 then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            'VEHICLE_IDENTITY_INVALID', '車両のナンバーまたはモデルを確認できません。')
        return
    end

    local allowed, reason = ownershipAllowed(source, vehicle, identity, plate, model)
    if not allowed then
        TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, false,
            reason or 'VEHICLE_NOT_OWNED', '所有権を確認できないため登録しませんでした。')
        return
    end

    -- Selecting a vehicle only stages a candidate. The prior committed registration
    -- and KVP remain untouched until the desktop confirms cargo access and commits.
    abortPendingRegistration(identity)
    local previous = committedRecord(identity)
    local registrationId
    repeat
        registrationId = 'amv_' .. randomHex(18)
    until not registrationsById[registrationId] and not pendingRegistrationById[registrationId]
        and not abortedRegistrationReceiptsById[registrationId]

    local now = os.time()
    local record = {
        id = registrationId,
        identity = identity,
        plate = plate,
        model = model,
        label = sanitizeLabel(clientLabel, model),
        networkId = NetworkGetNetworkIdFromEntity(vehicle),
        createdAt = now,
        lastSeen = now,
        available = true,
        availabilityCode = '',
        pending = true,
        previousId = previous and previous.id or '',
        transactionStartedAt = now,
        transactionExpiresAt = now + math.max(1,
            math.floor((tonumber(Config.Registration.TransactionTimeoutMs) or 180000) / 1000)),
        source = source
    }
    pendingRegistrationByIdentity[identity] = record
    pendingRegistrationById[registrationId] = record
    setRegistrationState(vehicle, registrationId)
    debugLog(('staged %s for source %s (previous %s)'):format(registrationId, source,
        record.previousId ~= '' and record.previousId or 'none'))

    -- REGISTERED is retained for v1 desktop compatibility. The transaction object
    -- is authoritative: pending=true means this ID is not committed or persisted.
    TriggerClientEvent('ai_miner_companion:client:registrationResult', source, requestId, true,
        'REGISTERED', '車両候補を仮登録しました。荷台確認後に確定してください。',
        publicRecord(record), previous and publicRecord(previous) or nil, publicTransaction(record))
end)

RegisterNetEvent('ai_miner_companion:server:commitRegistration', function(requestId, registrationId)
    local source = source
    if not validRequestId(requestId) or not validRegistrationId(registrationId) then return end
    local identity = getIdentity(source)
    local pending = identity and pendingRegistrationByIdentity[identity] or nil
    local active = identity and committedRecord(identity) or nil

    -- A lost response must not turn a successful commit into a local rollback.
    -- Repeating the exact candidate ID is therefore an idempotent success.
    if identity and not pending and active and active.id == registrationId then
        TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
            true, 'REGISTRATION_COMMITTED', '車両登録はすでに確定済みです。', publicRecord(active))
        return
    end

    if not identity or not pending or pending.id ~= registrationId
        or pendingRegistrationById[registrationId] ~= pending then
        TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
            false, 'REGISTRATION_TRANSACTION_NOT_FOUND', '確定できる車両候補がありません。',
            active and publicRecord(active) or nil)
        return
    end
    if isRateLimited(source, 'commit_registration', 300) then
        TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
            false, 'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    if pendingExpired(pending) then
        local _, previous = abortPendingRegistration(identity)
        TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
            false, 'REGISTRATION_TRANSACTION_EXPIRED', '仮登録の有効時間が切れました。',
            previous and publicRecord(previous) or nil)
        return
    end

    -- Commit repeats proximity, entity identity, and ownership validation. Any
    -- terminal validation failure rolls the candidate back and preserves the KVP.
    local vehicle, record, reason = resolveRecord(source, registrationId, Config.Cargo.ServerOpenDistance)
    if not vehicle then
        local _, previous = abortPendingRegistration(identity)
        TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
            false, reason or 'REGISTRATION_COMMIT_REJECTED',
            '荷台確認後の再検証に失敗したため、以前の登録を維持しました。',
            previous and publicRecord(previous) or nil)
        return
    end

    local previous = committedRecord(identity)
    -- Write the new durable record before removing the in-memory old record. If
    -- the KVP native raises, the staged transaction remains retryable in memory.
    persistRecord(record)
    if previous and previous.id ~= record.id then
        clearRegistrationState(previous, record)
        local previousBinding = previous.identity .. '\0' .. previous.plate .. '\0' .. tostring(previous.model)
        if registrationByBinding[previousBinding] == previous.id then
            registrationByBinding[previousBinding] = nil
        end
        registrationsById[previous.id] = nil
    end

    pendingRegistrationByIdentity[identity] = nil
    pendingRegistrationById[record.id] = nil
    record.pending = nil
    record.previousId = nil
    record.transactionStartedAt = nil
    record.transactionExpiresAt = nil
    record.source = nil

    local binding = identity .. '\0' .. record.plate .. '\0' .. tostring(record.model)
    registrationsById[record.id] = record
    registrationByBinding[binding] = record.id
    activeRegistrationByIdentity[identity] = record.id
    setRegistrationState(vehicle, record.id)
    debugLog(('committed %s for source %s'):format(record.id, source))

    TriggerClientEvent('ai_miner_companion:client:commitRegistrationResult', source, requestId,
        true, 'REGISTRATION_COMMITTED', '荷台確認済みの車両登録を確定しました。', publicRecord(record))
end)

RegisterNetEvent('ai_miner_companion:server:abortRegistration', function(requestId, registrationId)
    local source = source
    if not validRequestId(requestId) or not validRegistrationId(registrationId) then return end
    local identity = getIdentity(source)
    local pending = identity and pendingRegistrationByIdentity[identity] or nil
    local active = identity and committedRecord(identity) or nil
    if not identity or not pending or pending.id ~= registrationId
        or pendingRegistrationById[registrationId] ~= pending then
        local receipt = abortedRegistrationReceiptsById[registrationId]
        if identity and receipt and receipt.identity == identity and receipt.source == source
            and receipt.expiresAt >= os.time() then
            TriggerClientEvent('ai_miner_companion:client:abortRegistrationResult', source, requestId,
                true, 'REGISTRATION_ABORTED', '仮登録はすでに取り消し済みです。',
                active and publicRecord(active) or nil)
            return
        end
        TriggerClientEvent('ai_miner_companion:client:abortRegistrationResult', source, requestId,
            false, 'REGISTRATION_TRANSACTION_NOT_FOUND', '取り消せる車両候補がありません。',
            active and publicRecord(active) or nil)
        return
    end
    if isRateLimited(source, 'abort_registration', 200) then
        TriggerClientEvent('ai_miner_companion:client:abortRegistrationResult', source, requestId,
            false, 'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    local _, previous = abortPendingRegistration(identity)
    TriggerClientEvent('ai_miner_companion:client:abortRegistrationResult', source, requestId,
        true, 'REGISTRATION_ABORTED', '仮登録を取り消し、以前の登録を維持しました。',
        previous and publicRecord(previous) or nil)
end)

RegisterNetEvent('ai_miner_companion:server:resolveVehicle', function(requestId, registrationId)
    local source = source
    if not validRequestId(requestId) or not validRegistrationId(registrationId) then return end
    if isRateLimited(source, 'resolve', 200) then
        TriggerClientEvent('ai_miner_companion:client:resolveResult', source, requestId, false,
            'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    local vehicle, record, reason, distance = resolveRecord(source, registrationId,
        Config.Navigation.MaxVehicleDistance)
    if not vehicle then
        TriggerClientEvent('ai_miner_companion:client:resolveResult', source, requestId, false,
            reason, '登録車両を安全に特定できません。', record and publicRecord(record) or nil)
        return
    end

    TriggerClientEvent('ai_miner_companion:client:resolveResult', source, requestId, true,
        'VEHICLE_RESOLVED', '登録車両を確認しました。', publicRecord(record), distance)
end)

RegisterNetEvent('ai_miner_companion:server:authorizeCargo', function(requestId, registrationId, action)
    local source = source
    if not validRequestId(requestId) or not validRegistrationId(registrationId) then return end
    if action ~= 'arrive' and action ~= 'open' then return end
    if isRateLimited(source, 'cargo_' .. action, 200) then
        TriggerClientEvent('ai_miner_companion:client:cargoAuthorization', source, requestId, action,
            false, 'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    local vehicle, record, reason = resolveRecord(source, registrationId, Config.Cargo.ServerOpenDistance)
    if not vehicle then
        TriggerClientEvent('ai_miner_companion:client:cargoAuthorization', source, requestId, action,
            false, reason, '荷台の近くで登録車両を確認できません。', record and publicRecord(record) or nil)
        return
    end

    if action == 'open' and Config.Cargo.Mode == 'server_event' and Config.Cargo.ServerEvent ~= '' then
        -- Adapter receives authoritative server values. It must still enforce the
        -- inventory resource's own authorization and capacity rules.
        TriggerEvent(Config.Cargo.ServerEvent, source, vehicle, {
            registrationId = record.id,
            plate = record.plate,
            model = record.model,
            networkId = record.networkId
        })
    end

    TriggerClientEvent('ai_miner_companion:client:cargoAuthorization', source, requestId, action,
        true, action == 'open' and 'CARGO_AUTHORIZED' or 'ARRIVAL_AUTHORIZED',
        '登録車両の荷台を確認しました。', publicRecord(record))
end)

RegisterNetEvent('ai_miner_companion:server:clearRegistration', function(requestId, registrationId)
    local source = source
    if not validRequestId(requestId) or not validRegistrationId(registrationId) then return end
    if isRateLimited(source, 'clear', 300) then
        TriggerClientEvent('ai_miner_companion:client:clearRegistrationResult', source, requestId,
            false, 'RATE_LIMITED', '少し待ってから再試行してください。')
        return
    end

    local identity = getIdentity(source)
    if identity and pendingRegistrationByIdentity[identity] then
        TriggerClientEvent('ai_miner_companion:client:clearRegistrationResult', source, requestId,
            false, 'REGISTRATION_TRANSACTION_PENDING',
            '仮登録を確定または取り消してから登録を削除してください。')
        return
    end
    local requestedId = tostring(registrationId or '')
    local record = registrationsById[requestedId]
    if not record and identity then
        local persisted = loadPersistedRecord(identity)
        if persisted and persisted.id == requestedId then record = persisted end
    end
    if not identity or not record or record.identity ~= identity
        or activeRegistrationByIdentity[identity] ~= record.id then
        TriggerClientEvent('ai_miner_companion:client:clearRegistrationResult', source, requestId,
            false, 'REGISTRATION_NOT_FOUND', '削除できる車両登録がありません。')
        return
    end

    clearRegistrationState(record, nil)

    local binding = record.identity .. '\0' .. record.plate .. '\0' .. tostring(record.model)
    registrationsById[record.id] = nil
    registrationByBinding[binding] = nil
    if activeRegistrationByIdentity[identity] == record.id then
        activeRegistrationByIdentity[identity] = nil
    end
    DeleteResourceKvp(identityKvpKey(identity))

    TriggerClientEvent('ai_miner_companion:client:clearRegistrationResult', source, requestId,
        true, 'REGISTRATION_CLEARED', '車両登録を削除しました。')
end)

AddEventHandler('playerDropped', function()
    local droppedSource = source
    local identities = {}
    for identity, record in pairs(pendingRegistrationByIdentity) do
        if record.source == droppedSource then identities[#identities + 1] = identity end
    end
    for i = 1, #identities do abortPendingRegistration(identities[i]) end
    rateLimitBySource[droppedSource] = nil
    synchronizedClientEpochBySource[droppedSource] = nil
end)

CreateThread(function()
    while true do
        Wait(1000)
        local expired = {}
        for identity, record in pairs(pendingRegistrationByIdentity) do
            if pendingExpired(record) then
                expired[#expired + 1] = { identity = identity, record = record }
            end
        end
        for i = 1, #expired do
            expirePendingRegistration(expired[i].identity, expired[i].record)
        end
        local now = os.time()
        for registrationId, receipt in pairs(abortedRegistrationReceiptsById) do
            if receipt.expiresAt < now then abortedRegistrationReceiptsById[registrationId] = nil end
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= RESOURCE then return end
    local identities = {}
    for identity in pairs(pendingRegistrationByIdentity) do identities[#identities + 1] = identity end
    for i = 1, #identities do abortPendingRegistration(identities[i]) end
end)
