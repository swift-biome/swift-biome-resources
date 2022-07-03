module.exports = {
    entry: './sources/search.ts',
    module: 
    {
        rules: 
        [
            {
                use: 'ts-loader',
                test: /\.tsx?$/,
                exclude: /node_modules/,
            },
        ],
    },
};
