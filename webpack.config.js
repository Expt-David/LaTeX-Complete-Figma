const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

// Custom plugin to inline JavaScript for Figma plugins
class HtmlInlineSourcePlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap('HtmlInlineSourcePlugin', (compilation) => {
            const hooks = HtmlWebpackPlugin.getHooks(compilation);
            
            hooks.alterAssetTags.tapAsync(
                'HtmlInlineSourcePlugin',
                (data, cb) => {
                    // Find script tags that reference ui.js
                    data.assetTags.scripts = data.assetTags.scripts.map(tag => {
                        if (tag.attributes && tag.attributes.src === 'ui.js') {
                            // Get the JS content from compilation assets
                            const jsAsset = compilation.getAsset('ui.js');
                            if (jsAsset) {
                                const jsContent = jsAsset.source.source();
                                // Convert to inline script tag
                                return {
                                    tagName: 'script',
                                    innerHTML: jsContent,
                                    attributes: {}
                                };
                            }
                        }
                        return tag;
                    });
                    cb(null, data);
                }
            );

            hooks.afterEmit.tap('HtmlInlineSourcePlugin', () => {
                // Remove the ui.js file since it's now inlined
                compilation.deleteAsset('ui.js');
            });
        });
    }
}

module.exports = (env, argv) => ({
    mode: argv.mode === 'production' ? 'production' : 'development',

    // This is necessary because Figma's 'eval' works differently than normal eval
    devtool: argv.mode === 'production' ? false : 'inline-source-map',

    entry: {
        ui: './src/app/index.tsx', // The entry point for your UI code
        code: './src/plugin/controller.ts', // The entry point for your plugin code
    },

    module: {
        rules: [
            // Converts TypeScript code to JavaScript
            {test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/},

            // Enables including CSS by doing "import './file.css'" in your TypeScript code
            { test:/\.css$/, use:['style-loader','css-loader'] },

            // Allows you to use "<%= require('./file.svg') %>" in your HTML code to get a data URI
            { test:/\.(png|jpe?g|gif|webp|svg)$/, use:['url-loader'] },
        ],
    },

    // Webpack tries these extensions for you if you omit the extension like "import './file'"
    resolve: {extensions: ['.tsx', '.ts', '.jsx', '.js']},

    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'), // Compile into a folder called "dist"
    },

    // Tells Webpack to generate "ui.html" and to inline "ui.ts" into it
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/app/index.html',
            filename: 'ui.html',
            chunks: ['ui'],
            inject: 'body',
            minify: argv.mode === 'production' ? {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
            } : false,
        }),
        new HtmlInlineSourcePlugin(),
    ],
    // optimization: {
    //     splitChunks: {
    //         chunks: 'all',
    //     },
    // },
});
