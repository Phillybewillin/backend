const isProduction = process.env.PRODUCTION === 'true' || process.env.PRODUCTION === 'TRUE' || process.env.PRODUCTION === true;

if (isProduction) {
    console.log = function () { };
    console.debug = function () { };
    console.info = function () { };
}