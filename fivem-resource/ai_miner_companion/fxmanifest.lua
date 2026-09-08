fx_version 'cerulean'
game 'gta5'

author 'AI Miner contributors'
description 'Server-authorized dynamic vehicle companion for AI Miner'
version '1.1.0'

ui_page 'ui/index.html'

shared_script 'config.shared.lua'

client_script 'client.lua'
server_scripts {
    'config.server.lua',
    'server.lua'
}

files {
    'ui/index.html',
    'ui/styles.css',
    'ui/app.js'
}

dependency '/onesync'
