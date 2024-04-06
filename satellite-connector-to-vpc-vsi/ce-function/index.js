async function main(args) {
  const fetchResponse = await fetch(process.env.SAT_LINK_ENDPOINT);
  const body = await fetchResponse.text();
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      message: body,
    },
  };
}

module.exports.main = main;
