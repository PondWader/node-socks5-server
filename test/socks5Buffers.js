module.exports = {
    client: {
        greeting: (authMethods) => Buffer.from([5, authMethods.length, ...authMethods]),
        authenticationRequest: (username, password) => Buffer.concat([Buffer.from([0x01, username.length]), Buffer.from(username), Buffer.from([password.length]), Buffer.from(password)]),
        connectionRequest: (command, addrType, addrBuf, portBuf) => Buffer.concat([Buffer.from([0x05, command, 0x00, addrType]), addrBuf, portBuf])
    },
    server: {
        serverChoice: (selectedAuthMethod) => Buffer.from([5, selectedAuthMethod]),
        authenticationRespose: (status) => Buffer.from([0x01, status]),
        connectionResponse: (status, boundAddrBytes, boundPortBytes) => Buffer.from([0x05, status, 0x00, ...boundAddrBytes, ...boundPortBytes])
    }
}