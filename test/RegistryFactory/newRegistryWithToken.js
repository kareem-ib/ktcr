/* eslint-env mocha */
/* global contract assert artifacts */
const fs = require('fs');

const RegistryFactory = artifacts.require('./RegistryFactory.sol');

const Token = artifacts.require('tokens/eip20/EIP20.sol');
const PLCRVoting = artifacts.require('PLCRVoting.sol');
const Parameterizer = artifacts.require('Parameterizer.sol');
const Registry = artifacts.require('Registry.sol');

const config = JSON.parse(fs.readFileSync('./conf/config.json'));
const paramConfig = config.paramDefaults;

contract('RegistryFactory', (accounts) => {
  describe('Function: newRegistryWithToken', () => {
    it('should deploy and initialize a new Registry contract', async () => {
      const registryFactory = await RegistryFactory.deployed();
      const tokenParams = {
        supply: '1000',
        name: 'TEST',
        decimals: '2',
        symbol: 'TST',
      };

      // new parameterizer using factory/proxy
      const parameters = [
        paramConfig.minDeposit,
        paramConfig.pMinDeposit,
        paramConfig.applyStageLength,
        paramConfig.pApplyStageLength,
        paramConfig.commitStageLength,
        paramConfig.pCommitStageLength,
        paramConfig.revealStageLength,
        paramConfig.pRevealStageLength,
        paramConfig.dispensationPct,
        paramConfig.pDispensationPct,
        paramConfig.voteQuorum,
        paramConfig.pVoteQuorum,
      ];

      // new registry using factory/proxy
      const registryReceipt = await registryFactory.newRegistryWithToken(
        tokenParams.supply,
        tokenParams.name,
        tokenParams.decimals,
        tokenParams.symbol,
        parameters,
        'NEW TCR',
        { from: accounts[0] },
      );
      const { creator } = registryReceipt.logs[0].args;
      const registry = Registry.at(registryReceipt.logs[0].args.registry);

      // verify: registry's token
      const registryToken = Token.at(await registry.token.call());
      const tokenName = await registryToken.name.call();
      assert.strictEqual(
        tokenName,
        tokenParams.name,
        'the token attached to the Registry contract does not correspond to the one emitted in the newRegistry event',
      );
      // verify: registry's name
      const registryName = await registry.name.call();
      assert.strictEqual(
        registryName,
        'NEW TCR',
        'the registry\'s name is incorrect',
      );
      // verify: registry's creator
      assert.strictEqual(creator, accounts[0], 'the creator emitted in the newRegistry event ' +
        'not correspond to the one which sent the creation transaction');
    });

    it('should deploy a new token, plcr, parameterizer, and registry', async () => {
      async function giveTokensTo(tokenHolders, token) {
        // no token holders
        if (tokenHolders.length === 0) { return; }

        const tokenHolder = tokenHolders[0];
        // display converted unit amounts (account for decimals)
        const displayAmt = tokenHolder.amount.slice(
          0,
          tokenHolder.amount.length - parseInt(config.token.decimals, 10),
        );
        // eslint-disable-next-line
        console.log(`Allocating ${displayAmt} ${config.token.symbol} tokens to ` +
        `${tokenHolder.address}.`);
        // transfer to token holder
        await token.transfer(tokenHolder.address, tokenHolder.amount);

        // shift 1 ->
        await giveTokensTo(tokenHolders.slice(1), token);
      }

      const registryFactory = await RegistryFactory.deployed();
      const registryReceipt = await registryFactory.newRegistryWithToken(
        config.token.supply,
        config.token.name,
        config.token.decimals,
        config.token.symbol,
        [
          paramConfig.minDeposit,
          paramConfig.pMinDeposit,
          paramConfig.applyStageLength,
          paramConfig.pApplyStageLength,
          paramConfig.commitStageLength,
          paramConfig.pCommitStageLength,
          paramConfig.revealStageLength,
          paramConfig.pRevealStageLength,
          paramConfig.dispensationPct,
          paramConfig.pDispensationPct,
          paramConfig.voteQuorum,
          paramConfig.pVoteQuorum,
        ],
        config.name,
      );

      const {
        token,
        plcr,
        parameterizer,
        registry,
      } = registryReceipt.logs[0].args;

      const tokenInstance = await Token.at(token);
      await PLCRVoting.at(plcr);
      await Parameterizer.at(parameterizer);
      const registryProxy = await Registry.at(registry);

      console.log('token:', tokenInstance.address);
      console.log('registry:', registryProxy.address);

      await giveTokensTo(config.token.tokenHolders, tokenInstance);
    });
  });
});
