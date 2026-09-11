Config = {}

Config.Debug = false

Config.Registration = {
    -- Server distance is measured from the entity origin, so this accommodates
    -- long vans/trucks while still requiring local proximity.
    MaxDistance = 15.0,
    ArmTimeoutMs = 30000,
    -- A selected vehicle is only a staged candidate until cargo access succeeds
    -- and the desktop explicitly commits it. Timeout always preserves the prior KVP.
    TransactionTimeoutMs = 180000,
    -- Keeps only a short in-memory receipt so a lost abort response can be retried
    -- idempotently. It never resurrects or persists a staged registration.
    TransactionReceiptMs = 60000,
    RayDistance = 16.0,
    TargetDistance = 3.0
}

Config.Navigation = {
    -- The companion is intentionally bounded. It does not teleport or chase an
    -- unavailable/unstreamed vehicle across the map.
    MaxVehicleDistance = 250.0,
    MaxReturnDistance = 250.0,
    VehicleTimeoutMs = 90000,
    ReturnTimeoutMs = 90000,
    StreamTimeoutMs = 8000,
    Speed = 1.65,
    ArrivalDistance = 1.75,
    -- Work anchors require a tighter stop than a vehicle cargo interaction.
    WorkArrivalDistance = 0.40,
    RetaskIntervalMs = 1200,
    VehicleMoveRetaskDistance = 1.25,
    -- A small parking adjustment is retargeted. A driven/teleported vehicle is not
    -- chased indefinitely (speed values are metres per second).
    MaxTrackedVehicleSpeed = 2.5,
    MaxVehicleDisplacement = 12.0,
    MaxVehicleStepDistance = 6.0,
    StuckWindowMs = 5500,
    StuckMoveDistance = 0.30,
    StuckRetries = 3,
    RearOffset = 1.10,
    AlternateLateralOffset = 1.65,
    CameraPitch = -12.0,
    ManualOverrideGraceMs = 600,
    ManualMoveThreshold = 0.25
}

Config.Cargo = {
    -- Also measured from the vehicle entity origin; the client separately checks
    -- the computed rear point.
    ServerOpenDistance = 15.0,

    -- ox_inventory: after server revalidation, open the authoritative registered
    -- trunk through ox_inventory and require a positive open result.
    -- arrival_only: validate and face the exact registered cargo point; the desktop
    -- app can then activate the server's normal target/inventory UI.
    -- client_event: after validation, invoke ClientEvent for a server-specific adapter.
    -- server_event: after validation, invoke ServerEvent on the server.
    Mode = 'ox_inventory', -- ox_inventory | arrival_only | client_event | server_event
    ClientEvent = '',
    ServerEvent = ''
}

Config.Commands = {
    Bridge = 'aiminer_companion',
    RegisterFallback = 'aiminer-register',
    CancelFallback = 'aiminer-cancel'
}

Config.OxTarget = {
    Enabled = true,
    OptionName = 'ai_miner_companion:register',
    Label = 'AI採掘機に登録',
    Icon = 'fa-solid fa-truck-ramp-box'
}
