/* global artifacts, assert, contract, describe, it */
/* eslint-disable no-console, max-len */

const Registry = artifacts.require('OceanRegistry.sol')
const Token = artifacts.require('OceanToken.sol')
const Market = artifacts.require('OceanMarket.sol')
const PLCRVoting = artifacts.require('PLCRVoting.sol')
const Dispute = artifacts.require('OceanDispute.sol')
const OceanAuth = artifacts.require('OceanAuth.sol')
const Web3 = require('web3')
const ursa = require('ursa')
const ethers = require('ethers')

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const utils = require('./utils.js')

function mineBlock(web, reject, resolve) {
    web.currentProvider.sendAsync({
        method: 'evm_mine',
        jsonrpc: '2.0',
        id: new Date().getTime()
    }, (e) => (e ? reject(e) : resolve()))
}

function increaseTimestamp(web, increase) {
    return new Promise((resolve, reject) => {
        web.currentProvider.sendAsync({
            method: 'evm_increaseTime',
            params: [increase],
            jsonrpc: '2.0',
            id: new Date().getTime()
        }, (e) => (e ? reject(e) : mineBlock(web, reject, resolve)))
    })
}

contract('OceanDispute', (accounts) => {
    describe('Test User stories', () => {
        it('Should request tokens', async () => {
            const token = await Token.deployed()
            const market = await Market.deployed()
            const tcr = await Registry.deployed()
            const plcr = await PLCRVoting.deployed()
            const scale = 1

            // request initial fund
            await market.requestTokens(1000 * scale, { from: accounts[0] })
            await market.requestTokens(1000 * scale, { from: accounts[1] })
            await market.requestTokens(1000 * scale, { from: accounts[2] })
            await market.requestTokens(1000 * scale, { from: accounts[3] })
            await market.requestTokens(1000 * scale, { from: accounts[4] })
            const bal1 = await token.balanceOf.call(accounts[0])
            console.log(`Step 0: User has ${bal1.toNumber() / scale} Ocean tokens now.`)

            // approve tokens to be transferred into marketplace
            await token.approve(market.address, 1000 * scale, { from: accounts[0] })
            await token.approve(market.address, 1000 * scale, { from: accounts[1] })
            await token.approve(market.address, 1000 * scale, { from: accounts[2] })
            await token.approve(market.address, 1000 * scale, { from: accounts[3] })
            await token.approve(market.address, 1000 * scale, { from: accounts[4] })

            // approve tokens to be transferred into Registry
            await token.approve(tcr.address, 1000 * scale, { from: accounts[0] })
            await token.approve(tcr.address, 1000 * scale, { from: accounts[1] })
            await token.approve(tcr.address, 1000 * scale, { from: accounts[2] })
            await token.approve(tcr.address, 1000 * scale, { from: accounts[3] })
            await token.approve(tcr.address, 1000 * scale, { from: accounts[4] })

            // approve tokens to be transferred into voting
            await token.approve(plcr.address, 1000 * scale, { from: accounts[0] })
            await token.approve(plcr.address, 1000 * scale, { from: accounts[1] })
            await token.approve(plcr.address, 1000 * scale, { from: accounts[2] })
            await token.approve(plcr.address, 1000 * scale, { from: accounts[3] })
            await token.approve(plcr.address, 1000 * scale, { from: accounts[4] })
        })


        it('should purchase service, raise dispute, and refund', async () => {
            // const marketPlace = await Market.deployed();
            const token = await Token.deployed()
            const market = await Market.deployed()
            const auth = await OceanAuth.deployed()
            const registry = await Registry.deployed()
            const voting = await PLCRVoting.deployed()
            const dispute = await Dispute.deployed()

            const minDeposit = 10

            // provider : accounts[0], consumer : accounts[1], voter : accounts[2]

            const str = 'resource'
            const resourceId = await market.generateId(str, { from: accounts[0] })
            const resourcePrice = 100
            // 1. provider register dataset
            await market.register(resourceId, resourcePrice, { from: accounts[0] })

            // 2. consumer initiate an access request
            const modulusBit = 512
            const key = ursa.generatePrivateKey(modulusBit, 65537)
            const privatePem = ursa.createPrivateKey(key.toPrivatePem())
            const publicPem = ursa.createPublicKey(key.toPublicPem())
            const publicKey = publicPem.toPublicPem('utf8')

            // consumer submit request and provider apply the service to registry
            const receipt = await auth.initiateAccessRequest(resourceId, accounts[0], publicKey, 9999999999, { from: accounts[1] })
            const accessId = receipt.logs[0].args._id
            console.log('consumer creates an access request with id : ', accessId)

            // provider submit application of access service with id so that voting can be created agains this service
            await utils.as(accounts[0], registry.apply, accessId, minDeposit, '')

            // 3. provider commit the request
            await auth.commitAccessRequest(accessId, true, 9999999999, 'discovery', 'read', 'slaLink', 'slaType', { from: accounts[0] })

            // 4. consumer make payment
            await market.sendPayment(accessId, accounts[0], 100, 9999999999, { from: accounts[1] })
            console.log('consumer has made payment for the order: 100 tokens')

            // 5. provider delivery the encrypted JWT token
            const OnChainPubKey = await auth.getTempPubKey(accessId, { from: accounts[0] })
            assert.strictEqual(publicKey, OnChainPubKey, 'two public keys should match.')
            const getPubKeyPem = ursa.coerceKey(OnChainPubKey)
            const encJWT = getPubKeyPem.encrypt('eyJhbGciOiJIUzI1', 'utf8', 'hex')
            // check status
            await auth.deliverAccessToken(accessId, `0x${encJWT}`, { from: accounts[0] })
            console.log('provider has delivered the encrypted JWT to on-chain')

            // 4. consumer download the encrypted token and decrypt
            const onChainencToken = await auth.getEncryptedAccessToken(accessId, { from: accounts[1] })
            const decryptJWT = privatePem.decrypt(onChainencToken.slice(2), 'hex', 'utf8') // remove '0x' prefix
            assert.strictEqual(decryptJWT.toString(), 'eyJhbGciOiJIUzI1', 'two public keys should match.')

            // 5. consumer sign the encypted JWT token using private key
            const prefix = '0x'
            const hexString = Buffer.from(onChainencToken).toString('hex')
            const signature = web3.eth.sign(accounts[1], `${prefix}${hexString}`)
            const sig = ethers.utils.splitSignature(signature)
            const fixedMsg = `\x19Ethereum Signed Message:\n${onChainencToken.length}${onChainencToken}`
            const fixedMsgSha = web3.sha3(fixedMsg)
            const res = await auth.verifySignature(accounts[1], fixedMsgSha, sig.v, sig.r, sig.s, { from: accounts[0] })
            console.log('validate the signature comes from consumer? isSigned: ', res)

            // consumer raise a dispute before provider can request the payment!
            const disputeReceipt = await dispute.initiateDispute(accessId, { from: accounts[1] })
            const pollID = disputeReceipt.logs[0].args._pollID
            console.log('consumer initiated a dispute against the service and create voting')

            // add authorized voters
            await dispute.addAuthorizedVoter(accessId, accounts[2], { from: accounts[0] })
            console.log('add accounts[1] as authorized voter')

            // 6. provider send the signed encypted JWT to ACL contract for verification (verify delivery of token)
            const requestResult = await auth.verifyAccessTokenDelivery(accessId, accounts[1], fixedMsgSha, sig.v, sig.r, sig.s, { from: accounts[0] })
            assert.strictEqual(requestResult.logs[0].args._dispute, true, 'request of release payment should fail because dispute exists.')
            console.log('provider cannot release payment because dispute exists')

            // ////////////////////////// Voting Period ////////////////////////////
            // Make sure it's cool to commit
            const cpa = await voting.commitPeriodActive.call(pollID)
            assert.strictEqual(cpa, true, 'Commit period should be active')

            // Virgin commit
            const tokensArg = 10
            const salt = 420
            const voteOption = 0
            await utils.commitVote(pollID, voteOption, tokensArg, salt, accounts[2], voting)
            console.log('voter has voted against the service')

            const numTokens = await voting.getNumTokens.call(accounts[2], pollID) // voter
            assert.strictEqual(numTokens.toString(10), tokensArg.toString(10), 'Should have committed the correct number of tokens')

            // Reveal - default commit time period is 3600 seconds
            await increaseTimestamp(web3, 4000)
            // Make sure commit period is inactive
            const commitPeriodActive = await voting.commitPeriodActive.call(pollID)
            assert.strictEqual(commitPeriodActive, false, 'Commit period should be inactive')
            // Make sure reveal period is active
            let rpa = await voting.revealPeriodActive.call(pollID)
            assert.strictEqual(rpa, true, 'Reveal period should be active')

            await voting.revealVote(pollID, voteOption, salt, { from: accounts[2] }) // voter

            await increaseTimestamp(web3, 3600)

            rpa = await voting.revealPeriodActive.call(pollID)
            assert.strictEqual(rpa, false, 'Reveal period should not be active')
            // updateStatus
            const pollResult = await voting.isPassed.call(pollID)
            assert.strictEqual(pollResult, false, 'Poll should not passed')
            console.log('Voting result is revealed: consumer wins')

            // /////////////////////////// voting finished ////////////////////////////
            const voteEnded = await dispute.votingEnded(accessId, { from: accounts[1] })
            assert.strictEqual(voteEnded, true, 'Poll should be finished')

            // check balance
            const balanceBefore = await token.balanceOf.call(accounts[1])
            console.log(`consumer has balance := ${balanceBefore.valueOf()} before resolving dispute`)
            await dispute.resolveDispute(accessId, { from: accounts[1] })
            console.log('consumer wins the dispute and get refund')

            // check balance
            const balanceAfter = await token.balanceOf.call(accounts[1])
            console.log(`consumer has balance := ${balanceAfter.valueOf()} after refund`)
            console.log('current balance 1005 = previous balance 890 + refund payment 100 + deposit for challenge 10 + reward for wining the voting 5')
        })
    })
})