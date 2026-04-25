const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const portFinderSync = require('portfinder-sync')
const path = require('path')

const infoColor = (_message) =>
{
    return `\u001b[1m\u001b[34m${_message}\u001b[39m\u001b[22m`
}

module.exports = merge(
    commonConfiguration,
    {
        mode: 'development',
        devServer:
        {
            host: '0.0.0.0',
            port: portFinderSync.getPort(8080),
            static:
            {
                directory: path.resolve(__dirname, '../dist'),
                watch: true
            },
            open: true,
            server: 'http',
            allowedHosts: 'all',
            client:
            {
                overlay: true,
                logging: 'none'
            },
            onListening: function(server)
            {
                const port = server.options.port
                const domain = `http://localhost:${port}`
                
                console.log(`Project running at:\n  - ${infoColor(domain)}`)
            }
        }
    }
)
