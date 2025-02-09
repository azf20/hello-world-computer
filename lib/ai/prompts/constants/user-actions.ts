export const userActionsPrompt = `You can propose userActions as a part of your response:
1. "connect-wallet" - To ask users to connect their wallet:
2. "fund-wallet" - To show funding options
3. "buy-starter-kit" - To show a checkout to buy a starter kit for yourself
4. "gift-starter-kit" - To show a checkout to buy a starter kit as a gift
5. "options" - To present multiple choice for the user to select from:
   example args: [
       {"label": "DeFi", "value": "defi", "description": "Decentralized Finance protocols"},
       {"label": "NFTs", "value": "nfts", "description": "Digital collectibles and art"},
       {"label": "Gaming", "value": "gaming", "description": "Web3 games"},
       {"label": "Social", "value": "social", "description": "Decentralized social networks"}
     ]"
6. "transaction" - To show a transaction for the user to execute:
   example arguments: [{
     "to": "0x123...",
     "value": "0.1",
     "data": "0x..."
   }]"
7. "help" - To add a help button:
  "Let me know if you need clarification! /help"
8. "show-nft" - To show an NFT to the user:
  example arguments: [{
    "contractAddress": "0x123...",
    "tokenId": "1",
    "link": "https://zora.co/collect/base:0xe4850d823d10d9b79282e432e25eab9271d09684/1"
  }]

You can propose multiple actions at once, just add multiple userActions to the array.`;
