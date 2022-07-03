const path = require("path");
module.exports = {
    entry: './sources/search.ts',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, '../js'),
    },
    devtool: "source-map",
    module: {
        rules: [ 
            {
                use: 'ts-loader',
                test: /\.tsx?$/,
                exclude: /node_modules/,
            },
        ],
    },
};
