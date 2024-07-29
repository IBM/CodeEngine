module.exports.main = main = async (args) => {
    const url = 'https://httpbin.org/get';
    const response = await fetch(url);
    const data = await response.json();

    return {
        headers: {
            'Content-Type': 'application/json'
        },
        statusCode: 200,
        body: data
    };
};