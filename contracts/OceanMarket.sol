pragma solidity 0.4.24;

import './token/OceanToken.sol';
import './zeppelin/Ownable.sol';
import './zeppelin/SafeMath.sol';

contract OceanMarket is Ownable {

    using SafeMath for uint256;
    using SafeMath for uint;

    // data Asset
    struct Asset {
        address owner;  // owner of the Asset
        uint256 price;  // price of asset
        bool active;    // status of asset
    }

    mapping(bytes32 => Asset) public mAssets;           // mapping assetId to Asset struct

    struct Payment {
        address sender;             // consumer or anyone else would like to make the payment (automatically set to be msg.sender)
        address receiver;           // provider or anyone (set by the sender of funds)
        PaymentState state;         // payment state
        uint256 amount;             // amount of tokens to be transferred
        uint256 date;               // timestamp of the payment event (in sec.)
        uint256 expiration;         // consumer may request refund after expiration timestamp (in sec.)
        address contractAddress;    // the contract that can release and refund the payment
    }
    enum PaymentState {Locked, Released, Refunded}
    mapping(bytes32 => Payment) mPayments;  // mapping from id to associated payment struct

    // marketplace global variables
    OceanToken  public  mToken;

    // Events
    event AssetRegistered(bytes32 indexed _assetId, address indexed _owner);
    event PaymentReceived(bytes32 indexed _paymentId, address indexed _receiver, uint256 _amount, uint256 _expire);
    event PaymentReleased(bytes32 indexed _paymentId, address indexed _receiver);
    event PaymentRefunded(bytes32 indexed _paymentId, address indexed _sender);

    // modifier
    modifier validAddress(address sender) {
        require(sender != address(0x0), 'Sender address is 0x0.');
        _;
    }

    modifier isLocked(bytes32 _paymentId) {
        require(mPayments[_paymentId].state == PaymentState.Locked, 'State is not Locked');
        _;
    }

    modifier isContract(bytes32 _paymentId) {
        require(mPayments[_paymentId].contractAddress == msg.sender, 'Sender is not contract.');
        _;
    }

    ///////////////////////////////////////////////////////////////////
    //  Constructor function
    ///////////////////////////////////////////////////////////////////
    // 1. constructor
    constructor(address _tokenAddress) public {
        require(_tokenAddress != address(0x0), 'Token address is 0x0.');
        // instantiate deployed Ocean token contract
        mToken = OceanToken(_tokenAddress);
        // set the token receiver to be marketplace
        mToken.setReceiver(address(this));
    }

    ///////////////////////////////////////////////////////////////////
    // Actor and Asset routine procedures
    ///////////////////////////////////////////////////////////////////

    // 1. register provider and assets （upload by changing uploadBits）
    function register(bytes32 assetId, uint256 price) public validAddress(msg.sender) returns (bool success) {
        // check for unique assetId
        require(mAssets[assetId].owner == address(0), 'Owner address is not 0x0.');
        // ndrops =10, nToken = 1 => phatom tokesn to avoid failure of Bancor formula
        mAssets[assetId] = Asset(msg.sender, price, false);
        // Creates new struct and saves in storage. We leave out the mapping type.
        mAssets[assetId].active = true;

        emit AssetRegistered(assetId, msg.sender);
        return true;
    }

    // the sender makes payment
    /* solium-disable-next-line */
    function sendPayment(bytes32 _paymentId, address _receiver, uint256 _amount, uint256 _expire, address _contract) public validAddress(msg.sender) returns (bool) {
        // consumer make payment to Market contract
        require(mToken.transferFrom(msg.sender, address(this), _amount), 'Token transferFrom failed.');
        /* solium-disable-next-line */
        mPayments[_paymentId] = Payment(msg.sender, _receiver, PaymentState.Locked, _amount, block.timestamp, _expire, _contract);
        emit PaymentReceived(_paymentId, _receiver, _amount, _expire);
        return true;
    }

    // the consumer release payment to receiver
    function releasePayment(bytes32 _paymentId) public isLocked(_paymentId) isContract(_paymentId) returns (bool) {
        // update state to avoid re-entry attack
        mPayments[_paymentId].state == PaymentState.Released;
        require(mToken.transfer(mPayments[_paymentId].receiver, mPayments[_paymentId].amount), 'Token transfer failed.');
        emit PaymentReleased(_paymentId, mPayments[_paymentId].receiver);
        return true;
    }

    // refund payment
    function refundPayment(bytes32 _paymentId) public isLocked(_paymentId) isContract(_paymentId) returns (bool) {
        mPayments[_paymentId].state == PaymentState.Refunded;
        require(mToken.transfer(mPayments[_paymentId].sender, mPayments[_paymentId].amount), 'Token transfer failed.');
        emit PaymentRefunded(_paymentId, mPayments[_paymentId].sender);
        return true;
    }

    // utitlity function - verify the payment
    function verifyPayment(bytes32 _paymentId) public view returns (bool) {
        if (mPayments[_paymentId].state == PaymentState.Locked || mPayments[_paymentId].state == PaymentState.Released) {
            return true;
        }
        return false;
    }

    // 2. request initial fund transfer
    function requestTokens(uint256 amount) public validAddress(msg.sender) returns (bool) {
        require(mToken.transfer(msg.sender, amount), 'Token transfer failed.');
        return true;
    }

    ///////////////////////////////////////////////////////////////////
    // Utility Functions
    ///////////////////////////////////////////////////////////////////

    // calculate hash of input parameter - string
    function generateId(string contents) public pure returns (bytes32) {
        // Generate the hash of input bytes
        return bytes32(keccak256(abi.encodePacked(contents)));
    }

    // calculate hash of input parameter - bytes
    function generateId(bytes contents) public pure returns (bytes32) {
        // Generate the hash of input bytes
        return bytes32(keccak256(abi.encodePacked(contents)));
    }

}