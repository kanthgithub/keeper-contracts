#!/bin/bash

ganache-cli -b ${BLOCK_TIME} --hostname "${LISTEN_ADDRESS}" --port "${LISTEN_PORT}" &

sleep 2

truffle migrate

# Flag to indicate contracts are ready
touch /keeper-contracts/artifacts/ready

tail -f /dev/null
