// Generated by CoffeeScript 2.3.2
(function() {
  var SitemapParser, agentOptions, async, headers, request, sax, urlParser, zlib;

  request = require('request');

  sax = require('sax');

  async = require('async');

  zlib = require('zlib');

  urlParser = require('url');

  headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3630.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    //'Accept-Encoding' : 'gzip,sdch',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'cookie': 'us=8EC2C7F7-4CD9-49DA-B253-764212302B72; general%5Fmaturity=1; NSC_xxx01=30dfa3db17906a29b3222a8dbd50efa61f142e3f1d09e5d8edc0863017affbed4d456f75; bx=zlng%3den%26zlng_x%3d131929632000000000; pxvid=879b87a0-fe17-11e8-bd7e-01cad0887e3d; _pxvid=879b87a0-fe17-11e8-bd7e-01cad0887e3d; zm=AQABAAAA_hIAABTvL9iUpAwfvhE6Zb8eJ-3hZ_6Bft7JMi61oGddjfB1sraVokP6mnxYiYlfuW00PVIna9YEEDjWOtID-OW-kNauPQsH3ioPqfYvZQYnhamGFlc96VMO1eJ3qGi2DAqiFD16tQpK; zs=1147746D-BF55-41F4-B5C6-3129F1BFD366%7c0%7c13189121494%7cAQABAAAA_hIAABTxszUMFWD3yuMxivjNIVwGelJaD6sxPiwk2waHxRI3q8wfWwffHRfJgn_JPV69G2zNMQFP%7c'
  };

  agentOptions = {
    keepAlive: true,
    gzip: true
  };

  request = request.defaults({
    headers,
    agentOptions,
    timeout: 60000
  });

  SitemapParser = class SitemapParser {
    constructor(url_cb1, sitemap_cb1) {
      this.parse = this.parse.bind(this);
      this.url_cb = url_cb1;
      this.sitemap_cb = sitemap_cb1;
      this.visited_sitemaps = {};
    }

    _download(url, parserStream, done) {
      //console.log(url);
      var stream, unzip;
      if (url.lastIndexOf('.gz') === url.length - 3) {
        unzip = zlib.createUnzip();
        var r= request.get({url,encoding:null});
        r.pause();
        r.on('response', function (resp) {
           if(resp.statusCode === 200){
               r.pipe(unzip).pipe(parserStream);
               r.resume();
           }else{  
              console.log('Unsucessfull response code '+ resp.statusCode );
               r.pipe(parserStream);
               r.resume()
           }
        });
         return r;
        // return request.get({
        //   url,
        //   encoding: null
        // }).pipe(unzip).pipe(parserStream);
      } else {
        stream = request.get({
          url,
          gzip: true
        });
        stream.on('error', (err) => {
          return done(err);
        });
        return stream.pipe(parserStream);
      }
    }

    parse(url, done) {
      var inLoc, isSitemapIndex, isURLSet, parserStream;
      isURLSet = false;
      isSitemapIndex = false;
      inLoc = false;
      this.visited_sitemaps[url] = true;
      parserStream = sax.createStream(false, {
        trim: true,
        normalize: true,
        lowercase: true
      });
      parserStream.on('opentag', (node) => {
        inLoc = node.name === 'loc';
        if (node.name === 'urlset') {
          isURLSet = true;
        }
        if (node.name === 'sitemapindex') {
          return isSitemapIndex = true;
        }
      });
      parserStream.on('error', (err) => {
        return done(err);
      });
      parserStream.on('text', (text) => {
        //console.log(text);
        try{
          text=decodeURIComponent(text);
        }catch(err){
          text=encodeURIComponent(text);
        }
        text = urlParser.resolve(url, text);
        if (inLoc) {
          if (isURLSet) {
            return this.url_cb(text, url);
          } else if (isSitemapIndex) {
            if (this.visited_sitemaps[text] != null) {
              return console.error(`Already parsed sitemap: ${text}`);
            } else {
              return this.sitemap_cb(text);
            }
          }
        }
      });
      parserStream.on('end', () => {
        return done(null);
      });
      return this._download(url, parserStream, done);
    }

  };

  exports.parseSitemap = function(url, url_cb, sitemap_cb, done) {
    var parser;
    parser = new SitemapParser(url_cb, sitemap_cb);
    return parser.parse(url, done);
  };

  exports.parseSitemaps = function(urls, url_cb, sitemap_test, done) {
    var parser, queue;
    if (!done) {
      done = sitemap_test;
      sitemap_test = void 0;
    }
    if (!(urls instanceof Array)) {
      urls = [urls];
    }
    parser = new SitemapParser(url_cb, function(sitemap) {
      var should_push;
      should_push = sitemap_test ? sitemap_test(sitemap) : true;
      if (should_push) {
        return queue.push(sitemap);
      }
    });
    queue = async.queue(parser.parse, 4);
    queue.drain = function() {
      return done(null, Object.keys(parser.visited_sitemaps));
    };
    return queue.push(urls);
  };

  exports.parseSitemapsPromise = function(urls, url_cb, sitemap_test) {
    return new Promise(function(resolve) {
      return exports.parseSitemaps(urls, url_cb, sitemap_test, resolve);
    });
  };

  exports.sitemapsInRobots = function(url, cb) {

    return request.get(url, function(err, res, body) {
      var matches;
      if (err) {
        return cb(err);
      }
      if (res.statusCode !== 200) {
        return cb(`statusCode: ${res.statusCode}`);
      }
      matches = [];
      body.replace(/^Sitemap:\s?([^\s]+)$/igm, function(m, p1) {
        return matches.push(p1);
      });
      return cb(null, matches);
    });
  };

}).call(this);
