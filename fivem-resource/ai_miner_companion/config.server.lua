ServerConfig = {}

-- Registration is deliberately server-authorized. Keep "hook" in production and
-- replace Validator with the ownership lookup used by your framework/garage.
-- "ace" and "allow_all" are explicit opt-ins; the shipped configuration fails closed.
ServerConfig.Ownership = {
    Mode = 'hook', -- hook | ace | allow_all
    AcePermission = 'ai_miner.vehicle.register',
    Validator = function(source, vehicle, context)
        -- Adapter point examples:
        --   ESX/QBCore garage table lookup using context.ownerIdentifier/context.plate
        --   an export from the server's vehicle ownership resource
        -- Never trust a plate or owner flag supplied by a client.
        return false, 'OWNERSHIP_ADAPTER_NOT_CONFIGURED'
    end
}

-- Override this if your character identity differs from the FiveM license identifier.
-- Returning nil rejects the request rather than creating an unbound registration.
ServerConfig.IdentityProvider = function(source)
    local identifiers = GetPlayerIdentifiers(source)
    for i = 1, #identifiers do
        if identifiers[i]:sub(1, 8) == 'license:' then
            return identifiers[i]
        end
    end
    return nil
end
