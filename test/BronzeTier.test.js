
const { ethers,timeAndMine } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require('@ethersproject/bignumber')
const {solidity} = require('ethereum-waffle');

chai.use(solidity);

const expect = chai.expect;
function getEthers(inputEther) {
    return BigNumber.from(ethers.utils.parseEther(inputEther))
}
function getNegativeEthers(inputEther) {
    return BigNumber.from(ethers.utils.parseEther(inputEther)).mul(BigNumber.from(-1))
}

describe("BronzeTierStakingContract", async () =>  {
    let deployerAddress,anotherUser1, bronzeTier, standardToken, deployer;

beforeEach(async () =>  {
    const [owner, user1] = await ethers.getSigners();
    deployer = owner;
    anotherUser1 = user1;
    const Token = await ethers.getContractFactory("StandardToken");

    standardToken = await Token.deploy(owner.address, "Demo Token","DT",18,ethers.utils.parseEther('1000000'));
    await standardToken.deployed();
    deployerAddress = owner.address;
    const BronzeTierStakingContract = await ethers.getContractFactory('BronzeTierStakingContract');
    bronzeTier = await BronzeTierStakingContract.deploy(deployerAddress, standardToken.address,deployerAddress);
    await bronzeTier.deployed();
});
  describe("depositor", ()=>{
      it("should return the correct depositor address", async () => {
        const config = await bronzeTier.CONFIG();
        expect(config.depositor).to.equal(deployerAddress);
      });
  })
  describe("single lock",async ()=>{
    it("should revert if the address is 0", async () => {
      expect(bronzeTier.singleLock("0x0000000000000000000000000000000000000000",1)).to.be.revertedWith("No ADDR");
    });

    it("should revert if the amount is 0", async () => {
      expect(bronzeTier.singleLock(deployerAddress,0)).to.be.revertedWith("No AMT");
    });

    it("should revert depositor allowed is different address", async () => {
      await bronzeTier.setDepositor(standardToken.address);
      expect(bronzeTier.singleLock(deployerAddress,1)).to.be.revertedWith("Only depositor can call this function");
    });

    it("should be revert for single lock with 999 Tokens", async () => {
        await standardToken.approve(bronzeTier.address,ethers.utils.parseEther('999'));
        expect(bronzeTier.singleLock(deployerAddress,ethers.utils.parseEther('999'))).to.be.revertedWith('MIN DEPOSIT');
      });
    it("should be successful for single lock with more than 1000 TOKENS", async () => {
      await standardToken.approve(bronzeTier.address,ethers.utils.parseEther('1000'));
      await expect(() => bronzeTier.singleLock(deployerAddress,ethers.utils.parseEther('1000'))).to.changeTokenBalance(standardToken,deployer, getNegativeEthers('1000'));
    });

    it("should be successful for single lock and it should same iPP for both users with sum to be matched", async () => {
        await standardToken.approve(bronzeTier.address,ethers.utils.parseEther('3000'));
        await expect(() => bronzeTier.singleLock(anotherUser1.address,ethers.utils.parseEther('2000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('2000'));
        await expect(() => bronzeTier.singleLock(deployerAddress,ethers.utils.parseEther('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
        const result1 = await bronzeTier.getPoolPercentagesWithUser(anotherUser1.address);
        const result2 = await bronzeTier.getPoolPercentagesWithUser(deployerAddress);
        
        expect(result1[0].toString()).to.equal( ethers.utils.parseEther('24000'));
        expect(result1[1].toString()).to.equal(ethers.utils.parseEther('36000'));
        expect(result2[0].toString()).to.equal(ethers.utils.parseEther('12000'));
        expect(result2[1].toString()).to.equal(ethers.utils.parseEther('36000'));
    });

    it("should calculate iPP correct for multiple staking by single user", async () => {
        await standardToken.approve(bronzeTier.address,getEthers('3000'));
        await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('2000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('2000'));
        await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
        const result1 = await bronzeTier.getPoolPercentagesWithUser(anotherUser1.address);
        
        expect(result1[0].toString()).to.equal(ethers.utils.parseEther('36000'));
        expect(result1[1].toString()).to.equal(ethers.utils.parseEther('36000'));
    });
    it("should fail for withdrawl if its done before unlock duration", async () => {
        await standardToken.approve(bronzeTier.address,ethers.utils.parseEther('3000'));
        await expect(() => bronzeTier.singleLock(anotherUser1.address,ethers.utils.parseEther('2000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('2000'));
        await expect(() => bronzeTier.singleLock(deployerAddress,ethers.utils.parseEther('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
        const result1 = await bronzeTier.getPoolPercentagesWithUser(anotherUser1.address);
        const result2 = await bronzeTier.getPoolPercentagesWithUser(deployerAddress);
        const lockId = bronzeTier.USER_LOCKS(anotherUser1.address,0);
        expect(bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('100'))).to.be.revertedWith('Early withdrawal is disabled');
        expect(result1[0].toString()).to.equal( ethers.utils.parseEther('24000'));
        expect(result1[1].toString()).to.equal(ethers.utils.parseEther('36000'));
        expect(result2[0].toString()).to.equal(ethers.utils.parseEther('12000'));
        expect(result2[1].toString()).to.equal(ethers.utils.parseEther('36000'));
     });
    it("should calculate iPP correct for multiple staking by single user and then withdrawl after unlock duration", async () => {
     //const config = await bronzeTier.CONFIG();
      //console.log(config.tierId, config.multiplier, config.emergencyWithdrawlFee,1,config.unlockDuration, config.depositor, config.feeAddress,config.enableRewards);
      await bronzeTier.changeUnlockDuration(1);
      await standardToken.approve(bronzeTier.address,getEthers('4000'));
      await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('2000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('2000'));
      await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
      await expect(() => bronzeTier.singleLock(deployerAddress,getEthers('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
      const lockId = bronzeTier.USER_LOCKS(anotherUser1.address,0);
      const lockId2 = bronzeTier.USER_LOCKS(anotherUser1.address,1);
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('100'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('100')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('50'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('50')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('1840'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('1840')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId2,1,getEthers('1000'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('1000')));
      const result1 = await bronzeTier.getPoolPercentagesWithUser(deployerAddress);
      const result2 = await bronzeTier.getPoolPercentagesWithUser(anotherUser1.address);
      expect(result1[0].toString()).to.equal(getEthers('12000'));
      expect(result1[1].toString()).to.equal(getEthers('12120'));
      expect(result2[0].toString()).to.equal(getEthers('120'));
      expect(result2[1].toString()).to.equal(getEthers('12120'));
    });
    it("should calculate iPP correct for multiple staking by single user and then withdrawl", async () => {
      await bronzeTier.changeEarlyWithdrawl(1);
      await standardToken.approve(bronzeTier.address,getEthers('4000'));
      await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('2000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('2000'));
      await expect(() => bronzeTier.singleLock(anotherUser1.address,getEthers('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
      await expect(() => bronzeTier.singleLock(deployerAddress,getEthers('1000'))).to.changeTokenBalance(standardToken,deployer,getNegativeEthers('1000'));
      const lockId = bronzeTier.USER_LOCKS(anotherUser1.address,0);
      const lockId2 = bronzeTier.USER_LOCKS(anotherUser1.address,1);
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('100'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('98.8')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('50'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('49.4')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId,0,getEthers('1840'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('1817.92')));
      await expect(() => bronzeTier.connect(anotherUser1).withdraw(lockId2,1,getEthers('1000'))).to.changeTokenBalance(standardToken,anotherUser1,(getEthers('988')));
      const result1 = await bronzeTier.getPoolPercentagesWithUser(deployerAddress);
      const result2 = await bronzeTier.getPoolPercentagesWithUser(anotherUser1.address);
      expect(result1[0].toString()).to.equal(getEthers('12000'));
      expect(result1[1].toString()).to.equal(getEthers('12120'));
      expect(result2[0].toString()).to.equal(getEthers('120'));
      expect(result2[1].toString()).to.equal(getEthers('12120'));
  });
  })
});