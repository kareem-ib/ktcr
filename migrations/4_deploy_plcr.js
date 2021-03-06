/* global artifacts */

const Token = artifacts.require('EIP20.sol');
const DLL = artifacts.require('dll/DLL.sol');
const AttributeStore = artifacts.require('attrstore/AttributeStore.sol');
const PLCRVoting = artifacts.require('PLCRVoting.sol');

const fs = require('fs');

module.exports = (deployer, network, accounts) => {
  async function approvePLCRFor(addresses) {
    const token = await Token.deployed();
    const user = addresses[0];
    const balanceOfUser = await token.balanceOf.call(user);
    await token.approve(PLCRVoting.address, balanceOfUser, { from: user });
    if (addresses.length === 1) { return true; }
    return approvePLCRFor(addresses.slice(1));
  }

  deployer.link(DLL, PLCRVoting);
  deployer.link(AttributeStore, PLCRVoting);

  return deployer.then(async () => {
    let config = JSON.parse(fs.readFileSync('./conf/config.json'));
    if (network !== 'test') {
      config = JSON.parse(fs.readFileSync('./conf/configDecimals.json'));
    }

    if (process.argv[5] && (network === 'ganache' || network === 'rinkeby')) {
      config = JSON.parse(fs.readFileSync(`./conf/${process.argv[5]}.json`));
    }
    let tokenAddress = config.token.address;

    if (config.token.deployToken) {
      tokenAddress = Token.address;
    }

    await deployer.deploy(PLCRVoting);
    return (await PLCRVoting.deployed()).init(tokenAddress);
  })
    .then(async () => {
      if (network === 'test' || network === 'coverage') {
        await approvePLCRFor(accounts);
      }
    }).catch((err) => { throw err; });
};

