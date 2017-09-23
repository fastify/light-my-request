'use strict';

// Load modules

const Util = require('util');
const Stream = require('stream');
const Fs = require('fs');
const Zlib = require('zlib');
const Lab = require('lab');
const Shot = require('../lib');
const Code = require('code');

// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('inject()', () => {

    it('returns non-chunked payload', async () => {

        const output = 'example.com:8080|/hello';

        const dispatch = function (req, res) {

            res.statusMessage = 'Super';
            res.setHeader('x-extra', 'hello');
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length });
            res.end(req.headers.host + '|' + req.url);
        };

        const res = await Shot.inject(dispatch, 'http://example.com:8080/hello');
        expect(res.statusCode).to.equal(200);
        expect(res.statusMessage).to.equal('Super');
        expect(res.headers.date).to.exist();
        expect(res.headers).to.equal({
            date: res.headers.date,
            connection: 'keep-alive',
            'x-extra': 'hello',
            'content-type': 'text/plain',
            'content-length': output.length
        });
        expect(res.payload).to.equal(output);
        expect(res.rawPayload.toString()).to.equal('example.com:8080|/hello');
    });

    it('returns single buffer payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host + '|' + req.url);
        };

        const res = await Shot.inject(dispatch, { url: 'http://example.com:8080/hello' });
        expect(res.headers.date).to.exist();
        expect(res.headers.connection).to.exist();
        expect(res.headers['transfer-encoding']).to.equal('chunked');
        expect(res.payload).to.equal('example.com:8080|/hello');
        expect(res.rawPayload.toString()).to.equal('example.com:8080|/hello');
    });

    it('passes headers', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.super);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', headers: { Super: 'duper' } });
        expect(res.payload).to.equal('duper');
    });

    it('passes remote address', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.connection.remoteAddress);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', remoteAddress: '1.2.3.4' });
        expect(res.payload).to.equal('1.2.3.4');
    });

    it('passes localhost as default remote address', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.connection.remoteAddress);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' });
        expect(res.payload).to.equal('127.0.0.1');
    });

    it('passes host option as host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/hello', headers: { host: 'test.example.com' } });
        expect(res.payload).to.equal('test.example.com');
    });

    it('passes localhost as default host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/hello' });
        expect(res.payload).to.equal('localhost:80');
    });

    it('passes authority as host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/hello', authority: 'something' });
        expect(res.payload).to.equal('something');
    });

    it('passes uri host as host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' });
        expect(res.payload).to.equal('example.com:8080');
    });

    it('includes default http port in host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, 'http://example.com');
        expect(res.payload).to.equal('example.com:80');
    });

    it('includes default https port in host header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.host);
        };

        const res = await Shot.inject(dispatch, 'https://example.com');
        expect(res.payload).to.equal('example.com:443');
    });

    it('optionally accepts an object as url', async () => {

        const output = 'example.com:8080|/hello?test=1234';

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length });
            res.end(req.headers.host + '|' + req.url);
        };

        const url = {
            protocol: 'http',
            hostname: 'example.com',
            port: '8080',
            pathname: 'hello',
            query: {
                test: '1234'
            }
        };

        const res = await Shot.inject(dispatch, { url });
        expect(res.headers.date).to.exist();
        expect(res.headers.connection).to.exist();
        expect(res.headers['transfer-encoding']).to.not.exist();
        expect(res.payload).to.equal(output);
    });

    it('leaves user-agent unmodified', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers['user-agent']);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', headers: { 'user-agent': 'duper' } });
        expect(res.payload).to.equal('duper');
    });

    it('returns chunked payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, 'OK');
            res.write('a');
            res.write('b');
            res.end();
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.headers.date).to.exist();
        expect(res.headers.connection).to.exist();
        expect(res.headers['transfer-encoding']).to.equal('chunked');
        expect(res.payload).to.equal('ab');
    });

    it('sets trailers in response object', async () => {

        const dispatch = function (req, res) {

            res.setHeader('Trailer', 'Test');
            res.addTrailers({ 'Test': 123 });
            res.end();
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.headers.trailer).to.equal('Test');
        expect(res.headers.test).to.be.undefined();
        expect(res.trailers.test).to.equal('123');
    });

    it('parses zipped payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, 'OK');
            const stream = Fs.createReadStream('./package.json');
            stream.pipe(Zlib.createGzip()).pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        const file = Fs.readFileSync('./package.json', { encoding: 'utf-8' });
        const unzipped = await new Promise((resolve) => Zlib.unzip(res.rawPayload, (ignore, result) => resolve(result)));
        expect(unzipped.toString('utf-8')).to.equal(file);
    });

    it('returns multi buffer payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200);
            res.write('a');
            res.write(new Buffer('b'));
            res.end();
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.payload).to.equal('ab');
    });

    it('returns null payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Length': 0 });
            res.end();
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.payload).to.equal('');
    });

    it('allows ending twice', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Length': 0 });
            res.end();
            res.end();
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.payload).to.equal('');
    });

    it('identifies injection object', async () => {

        const dispatch = function (req, res) {

            expect(Shot.isInjection(req)).to.equal(true);
            expect(Shot.isInjection(res)).to.equal(true);

            res.writeHead(200, { 'Content-Length': 0 });
            res.end();
        };

        await Shot.inject(dispatch, { method: 'get', url: '/' });
    });

    it('pipes response', async () => {

        let finished = false;
        const dispatch = function (req, res) {

            res.writeHead(200);
            const stream = internals.getTestStream();

            res.on('finish', () => {

                finished = true;
            });

            stream.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(finished).to.equal(true);
        expect(res.payload).to.equal('hi');
    });

    it('pipes response with old stream', async () => {

        let finished = false;
        const dispatch = function (req, res) {

            res.writeHead(200);
            const stream = internals.getTestStream();
            stream.pause();
            const stream2 = new Stream.Readable().wrap(stream);
            stream.resume();

            res.on('finish', () => {

                finished = true;
            });

            stream2.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(finished).to.equal(true);
        expect(res.payload).to.equal('hi');
    });

    it('echos object payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'content-type': req.headers['content-type'] });
            req.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 } });
        expect(res.headers['content-type']).to.equal('application/json');
        expect(res.payload).to.equal('{"a":1}');
    });

    it('echos buffer payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200);
            req.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: new Buffer('test!') });
        expect(res.payload).to.equal('test!');
    });

    it('echos object payload with non-english utf-8 string', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'content-type': req.headers['content-type'] });
            req.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: { a: '½½א' } });
        expect(res.headers['content-type']).to.equal('application/json');
        expect(res.payload).to.equal('{"a":"½½א"}');
    });

    it('echos object payload without payload', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200);
            req.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test' });
        expect(res.payload).to.equal('');
    });

    it('retains content-type header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'content-type': req.headers['content-type'] });
            req.pipe(res);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 }, headers: { 'content-type': 'something' } });
        expect(res.headers['content-type']).to.equal('something');
        expect(res.payload).to.equal('{"a":1}');
    });

    it('adds a content-length header if none set when payload specified', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers['content-length']);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 } });
        expect(res.payload).to.equal('{"a":1}'.length.toString());
    });

    it('retains a content-length header when payload specified', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers['content-length']);
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/test', payload: '', headers: { 'content-length': '10' } });
        expect(res.payload).to.equal('10');
    });

    it('can handle a stream payload', async () => {

        const dispatch = function (req, res) {

            internals.readStream(req, (buff) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(buff);
            });
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/', payload: internals.getTestStream() });
        expect(res.payload).to.equal('hi');
    });

    it('can handle a stream payload of utf-8 strings', async () => {

        const dispatch = function (req, res) {

            internals.readStream(req, (buff) => {

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(buff);
            });
        };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/', payload: internals.getTestStream('utf8') });
        expect(res.payload).to.equal('hi');
    });

    it('can override stream payload content-length header', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers['content-length']);
        };

        const headers = { 'content-length': '100' };

        const res = await Shot.inject(dispatch, { method: 'post', url: '/', payload: internals.getTestStream(), headers });
        expect(res.payload).to.equal('100');
    });
});

describe('writeHead()', () => {

    it('returns single buffer payload', async () => {

        const reply = 'Hello World';
        const statusCode = 200;
        const statusMessage = 'OK';
        const dispatch = function (req, res) {

            res.writeHead(statusCode, statusMessage, { 'Content-Type': 'text/plain', 'Content-Length': reply.length });
            res.end(reply);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: '/' });
        expect(res.statusCode).to.equal(statusCode);
        expect(res.statusMessage).to.equal(statusMessage);
        expect(res.payload).to.equal(reply);
    });
});

describe('_read()', () => {

    it('plays payload', async () => {

        const dispatch = function (req, res) {

            let buffer = '';
            req.on('readable', () => {

                buffer = buffer + (req.read() || '');
            });

            req.on('close', () => {
            });

            req.on('end', () => {

                res.writeHead(200, { 'Content-Length': 0 });
                res.end(buffer);
                req.destroy();
            });
        };

        const body = 'something special just for you';
        const res = await Shot.inject(dispatch, { method: 'get', url: '/', payload: body });
        expect(res.payload).to.equal(body);
    });

    it('simulates split', async () => {

        const dispatch = function (req, res) {

            let buffer = '';
            req.on('readable', () => {

                buffer = buffer + (req.read() || '');
            });

            req.on('close', () => {
            });

            req.on('end', () => {

                res.writeHead(200, { 'Content-Length': 0 });
                res.end(buffer);
                req.destroy();
            });
        };

        const body = 'something special just for you';
        const res = await Shot.inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { split: true } });
        expect(res.payload).to.equal(body);
    });

    it('simulates error', async () => {

        const dispatch = function (req, res) {

            req.on('readable', () => { });

            req.on('error', () => {

                res.writeHead(200, { 'Content-Length': 0 });
                res.end('error');
            });
        };

        const body = 'something special just for you';
        const res = await Shot.inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { error: true } });
        expect(res.payload).to.equal('error');
    });

    it('simulates no end without payload', async () => {

        let end = false;
        const dispatch = function (req, res) {

            req.resume();
            req.on('end', () => {

                end = true;
            });
        };

        Shot.inject(dispatch, { method: 'get', url: '/', simulate: { end: false } });       // Stuck
        await internals.wait(10);
        expect(end).to.equal(false);
    });

    it('simulates no end with payload', async () => {

        let end = false;
        const dispatch = function (req, res) {

            req.resume();
            req.on('end', () => {

                end = true;
            });
        };

        Shot.inject(dispatch, { method: 'get', url: '/', payload: '1234567', simulate: { end: false } });       // Stuck
        await internals.wait(10);
        expect(end).to.equal(false);
    });

    it('simulates close', async () => {

        const dispatch = function (req, res) {

            let buffer = '';
            req.on('readable', () => {

                buffer = buffer + (req.read() || '');
            });

            req.on('close', () => {

                res.writeHead(200, { 'Content-Length': 0 });
                res.end('close');
            });

            req.on('end', () => {
            });
        };

        const body = 'something special just for you';
        const res = await Shot.inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { close: true } });
        expect(res.payload).to.equal('close');
    });

    it('errors for invalid input options', async () => {

        await expect(Shot.inject({}, {})).to.reject('Invalid dispatch function');
    });

    it('errors for missing url', async () => {

        const err = await expect(Shot.inject((req, res) => { }, {})).to.reject();
        expect(err.isJoi).to.be.true();
    });

    it('errors for an incorrect simulation object', async () => {

        const err = await expect(Shot.inject((req, res) => { }, { url: '/', simulate: 'sample string' })).to.reject();
        expect(err.isJoi).to.be.true();
    });

    it('ignores incorrect simulation object', async () => {

        const dispatch = function (req, res) {

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(req.headers.super);
        };

        const res = await Shot.inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', headers: { Super: 'duper' }, simulate: 'sample string', validate: false });
        expect(res.payload).to.equal('duper');
    });

    it('errors for an incorrect simulation object values', async () => {

        const err = await expect(Shot.inject((req, res) => { }, { url: '/', simulate: { end: 'wrong input' } })).to.reject();
        expect(err.isJoi).to.be.true();
    });
});


internals.getTestStream = function (encoding) {

    const Read = function () {

        Stream.Readable.call(this);
    };

    Util.inherits(Read, Stream.Readable);

    const word = 'hi';
    let i = 0;

    Read.prototype._read = function (size) {

        this.push(word[i] ? word[i++] : null);
    };

    const stream = new Read();

    if (encoding) {
        stream.setEncoding(encoding);
    }

    return stream;
};


internals.readStream = function (stream, callback) {

    const chunks = [];

    stream.on('data', (chunk) => chunks.push(chunk));

    stream.on('end', () => {

        return callback(Buffer.concat(chunks));
    });
};


internals.wait = function (timeout) {

    return new Promise((resolve) => setTimeout(resolve, timeout));
};
