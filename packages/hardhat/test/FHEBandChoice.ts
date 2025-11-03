import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FHEBandChoice, FHEBandChoice__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Users = {
  deployer: HardhatEthersSigner;
  john: HardhatEthersSigner;
  jane: HardhatEthersSigner;
};

async function setupContract() {
  const factory = (await ethers.getContractFactory("FHEBandChoice")) as FHEBandChoice__factory;
  const instance = (await factory.deploy()) as FHEBandChoice;
  const address = await instance.getAddress();
  return { bandChoice: instance, bandChoiceAddress: address };
}

describe("FHEBandChoice Contract", function () {
  let users: Users;
  let bandChoice: FHEBandChoice;
  let bandChoiceAddress: string;

  before(async function () {
    const [deployer, john, jane] = await ethers.getSigners();
    users = { deployer, john, jane };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("⚠️ Tests are intended to run only on FHE mock mode.");
      this.skip();
    }
    ({ bandChoice, bandChoiceAddress } = await setupContract());
  });

  it("initially, no users should have chosen a band", async function () {
    expect(await bandChoice.hasChosen(users.john.address)).to.be.false;
    expect(await bandChoice.hasChosen(users.jane.address)).to.be.false;
  });

  it("allows a new encrypted choice and blocks duplicate submissions", async function () {
    const band = 4;
    const enc = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(band).encrypt();

    await (await bandChoice.connect(users.john).makeChoice(enc.handles[0], enc.inputProof)).wait();

    expect(await bandChoice.hasChosen(users.john.address)).to.be.true;

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.john.address),
      bandChoiceAddress,
      users.john,
    );
    expect(decrypted).to.equal(band);

    const encAgain = await fhevm
      .createEncryptedInput(bandChoiceAddress, users.john.address)
      .add32(band + 1)
      .encrypt();
    await expect(
      bandChoice.connect(users.john).makeChoice(encAgain.handles[0], encAgain.inputProof),
    ).to.be.revertedWith("Already chosen");
  });

  it("permits users to independently make different encrypted choices", async function () {
    const johnBand = 2;
    const janeBand = 6;

    const johnEnc = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(johnBand).encrypt();
    const janeEnc = await fhevm.createEncryptedInput(bandChoiceAddress, users.jane.address).add32(janeBand).encrypt();

    await (await bandChoice.connect(users.john).makeChoice(johnEnc.handles[0], johnEnc.inputProof)).wait();
    await (await bandChoice.connect(users.jane).makeChoice(janeEnc.handles[0], janeEnc.inputProof)).wait();

    const johnDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.john.address),
      bandChoiceAddress,
      users.john,
    );
    const janeDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.jane.address),
      bandChoiceAddress,
      users.jane,
    );

    expect(johnDec).to.equal(johnBand);
    expect(janeDec).to.equal(janeBand);
  });

  it("allows a user to change their previous encrypted choice", async function () {
    const firstBand = 1;
    const newBand = 5;

    const encFirst = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(firstBand).encrypt();
    await (await bandChoice.connect(users.john).makeChoice(encFirst.handles[0], encFirst.inputProof)).wait();

    const encUpdated = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(newBand).encrypt();
    await (await bandChoice.connect(users.john).changeChoice(encUpdated.handles[0], encUpdated.inputProof)).wait();

    const result = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.john.address),
      bandChoiceAddress,
      users.john,
    );
    expect(result).to.equal(newBand);
  });

  it("rejects changeChoice if user never made an initial choice", async function () {
    const enc = await fhevm.createEncryptedInput(bandChoiceAddress, users.jane.address).add32(3).encrypt();
    await expect(bandChoice.connect(users.jane).changeChoice(enc.handles[0], enc.inputProof)).to.be.revertedWith(
      "No previous choice found",
    );
  });

  it("returns an empty encrypted value for users who haven't participated", async function () {
    const value = await bandChoice.viewUserChoice(users.jane.address);
    expect(value).to.eq(ethers.ZeroHash);
  });

  it("handles multiple users updating encrypted choices independently", async function () {
    const johnInitial = 1,
      johnNew = 6;
    const janeInitial = 3,
      janeNew = 2;

    const johnEnc1 = await fhevm
      .createEncryptedInput(bandChoiceAddress, users.john.address)
      .add32(johnInitial)
      .encrypt();
    const janeEnc1 = await fhevm
      .createEncryptedInput(bandChoiceAddress, users.jane.address)
      .add32(janeInitial)
      .encrypt();

    await (await bandChoice.connect(users.john).makeChoice(johnEnc1.handles[0], johnEnc1.inputProof)).wait();
    await (await bandChoice.connect(users.jane).makeChoice(janeEnc1.handles[0], janeEnc1.inputProof)).wait();

    const johnEnc2 = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(johnNew).encrypt();
    const janeEnc2 = await fhevm.createEncryptedInput(bandChoiceAddress, users.jane.address).add32(janeNew).encrypt();

    await (await bandChoice.connect(users.john).changeChoice(johnEnc2.handles[0], johnEnc2.inputProof)).wait();
    await (await bandChoice.connect(users.jane).changeChoice(janeEnc2.handles[0], janeEnc2.inputProof)).wait();

    const johnDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.john.address),
      bandChoiceAddress,
      users.john,
    );
    const janeDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.jane.address),
      bandChoiceAddress,
      users.jane,
    );

    expect(johnDec).to.equal(johnNew);
    expect(janeDec).to.equal(janeNew);
  });

  it("accepts encrypted values beyond expected band ID range", async function () {
    const johnChoice = 0;
    const janeChoice = 10;

    const johnEnc = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(johnChoice).encrypt();
    const janeEnc = await fhevm.createEncryptedInput(bandChoiceAddress, users.jane.address).add32(janeChoice).encrypt();

    await (await bandChoice.connect(users.john).makeChoice(johnEnc.handles[0], johnEnc.inputProof)).wait();
    await (await bandChoice.connect(users.jane).makeChoice(janeEnc.handles[0], janeEnc.inputProof)).wait();

    const johnDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.john.address),
      bandChoiceAddress,
      users.john,
    );
    const janeDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await bandChoice.viewUserChoice(users.jane.address),
      bandChoiceAddress,
      users.jane,
    );

    expect(johnDec).to.equal(johnChoice);
    expect(janeDec).to.equal(janeChoice);
  });

  it("prevents consecutive makeChoice calls for the same user", async function () {
    const choice = 3;
    const enc1 = await fhevm.createEncryptedInput(bandChoiceAddress, users.john.address).add32(choice).encrypt();
    await (await bandChoice.connect(users.john).makeChoice(enc1.handles[0], enc1.inputProof)).wait();

    const enc2 = await fhevm
      .createEncryptedInput(bandChoiceAddress, users.john.address)
      .add32(choice + 1)
      .encrypt();
    await expect(bandChoice.connect(users.john).makeChoice(enc2.handles[0], enc2.inputProof)).to.be.revertedWith(
      "Already chosen",
    );
  });
});
