pragma solidity ^0.4.24;

import '../zeppelin/StandardToken.sol';
import '../zeppelin/Ownable.sol';

/**
@title Ocean Protocol ERC20 Token Contract
@author Team: Fang Gong
*/

contract OceanToken is StandardToken {

    using SafeMath for uint256;

    // ============
    // DATA STRUCTURES:
    // ============
    string public constant name = 'OceanToken';                         // Set the token name for display
    string public constant symbol = 'OCN';                              // Set the token symbol for display

    // SUPPLY
    uint8 public constant decimals = 18;                               // Set the number of decimals for display
    uint256 public constant TOTAL_SUPPLY = 1400000000 * 10 ** 18;                 // OceanToken total supply

    // EMIT TOKENS
    address public _receiver = 0x0;                                   // address to receive TOKENS
    uint256 public totalSupply;                                       // total supply of Ocean tokens including initial tokens plus block rewards

    /**
    * @dev OceanToken Constructor
    * Runs only on initial contract creation.
    */
    constructor() public {
        totalSupply = TOTAL_SUPPLY;
    }

    /**
    * @dev setReceiver set the address to receive the emitted tokens
    * @param _to The address to send tokens
    * @return success setting is successful.
    */
    function setReceiver(address _to) public returns (bool success){
        require(_receiver == address(0), 'Receiver address is not 0x0.');
        _receiver = _to;
        // Creator address is assigned initial available tokens
        balances[_receiver] = TOTAL_SUPPLY;
        emit Transfer(0x0, _receiver, TOTAL_SUPPLY);
        return true;
    }

    /**
    * @dev Transfer token for a specified address when not paused
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(_to != address(0), 'To address is 0x0.');
        return super.transfer(_to, _value);
    }

    /**
    * @dev Transfer tokens from one address to another when not paused
    * @param _from address The address which you want to send tokens from
    * @param _to address The address which you want to transfer to
    * @param _value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(_to != address(0), 'To address is 0x0.');
        return super.transferFrom(_from, _to, _value);
    }

    /**
    * @dev Aprove the passed address to spend the specified amount of tokens on behalf of msg.sender when not paused.
    * @param _spender The address which will spend the funds.
    * @param _value The amount of tokens to be spent.
    */
    function approve(address _spender, uint256 _value) public returns (bool) {
        return super.approve(_spender, _value);
    }

    /**
    * @dev Gets the allowance amount of the specified address.
    * @param _owner The address to query the the allowance of.
    * @return An uint256 representing the amount allowance of the passed address.
    */
    function allowance(address _owner, address _spender) public constant returns (uint256) {
        return super.allowance(_owner, _spender);
    }

}
