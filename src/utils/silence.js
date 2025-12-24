if (process.env.PRODUCTION === 'true') {
    console.log = function () { };
}