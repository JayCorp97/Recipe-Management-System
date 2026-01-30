const { expect } = require("chai");

describe("Simple Test", function() {
  it("should pass a basic test", function() {
    expect(true).to.be.true;
  });

  it("should do basic math", function() {
    expect(1 + 1).to.equal(2);
  });
});
