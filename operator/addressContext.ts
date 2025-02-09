import * as dotenv from "dotenv";
import { gql, GraphQLClient } from "graphql-request";

dotenv.config();

const UNISWAP_V3 = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";
const HOP_PROTOCOL = "7YKiuzrmUxTpSN5DddDVFm9FDjQ5387dnEivHHdX9pAc";
const ENS_PROTOCOL = "5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH";

const uniswapClient = new GraphQLClient(
  `https://gateway.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/${UNISWAP_V3}`
);
const getUniswapV3SwapsQuery = (address: string) => gql`{
    swaps(where: {origin: "${address}"}) {
      amountUSD
      amount0
      amount1
      origin
      token1 {
        name
        symbol
      }
      token0 {
        name
        symbol
      }
      sender
      recipient
      transaction {
        timestamp
      }
    }
  }`;
const getUniswapV3SwapsByAddress = async (address: string) => {
  const query = getUniswapV3SwapsQuery(address.trim().toLowerCase());
  return await uniswapClient.request(query);
};

const hopProtocolClient = new GraphQLClient(
  `https://gateway.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/${HOP_PROTOCOL}`
);
const getHopProtocolBridgesQuery = (address: string) => gql`{
    bridgeTransfers(where: {transferFrom: "${address}"}) {
      transferFrom
      transferTo
      type
      toChainID
      from
      fromChainID
      isSwap
      timestamp
      amount
      amountUSD
      token {
        name
        symbol
      }
    }
  }`;
const getHopProtocolBridgeTransfersByAddress = async (address: string) => {
  const query = getHopProtocolBridgesQuery(address.trim().toLowerCase());
  return await hopProtocolClient.request(query);
};

const ensClient = new GraphQLClient(
  `https://gateway.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/${ENS_PROTOCOL}`
);
const getEnsDomainsQuery = (address: string) => gql`{
    domains(where: {resolvedAddress_: {id: "${address}"}}) {
      name
    }
  }`;
const getEnsDomainsByAddress = async (address: string) => {
  const query = getEnsDomainsQuery(address.trim().toLowerCase());
  return await ensClient.request(query);
};

(async () => {
  const res = await getEnsDomainsByAddress(
    "0xcd4bde67fe7c6eb601d03a35ea8a55eb2b136965"
  );
  console.log(res);
})();

export {
  getUniswapV3SwapsByAddress,
  getEnsDomainsByAddress,
  getHopProtocolBridgeTransfersByAddress,
};
