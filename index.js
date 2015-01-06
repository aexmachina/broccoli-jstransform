var Filter = require('broccoli-filter'),
    jstransform = require('jstransform'),
    minimatch = require('minimatch'),
    path = require('path'),
    fs = require('fs'),
    Promise = require('rsvp').Promise;

module.exports = JSTransformPlugin;
JSTransformPlugin.prototype = Object.create(Filter.prototype);
JSTransformPlugin.prototype.constructor = JSTransformPlugin;
function JSTransformPlugin(inputTree, options) {
  if (!(this instanceof JSTransformPlugin)) return new JSTransformPlugin(inputTree, options);
  this.options = {
    extensions: ['js'],
    ignoredFiles: [],
    visitors: null,
    transforms: null,
    sourceMap: false,
    glob: minimatch.makeRe('{**/,}*.js')
  };
  for (var key in options) {
    if (this.options.hasOwnProperty(key)) {
      this.options[key] = options[key];
    }
  }
  if (this.options.transforms) {
    this.visitors = jstransformVisitors(this.options.transforms);
  }
  else {
    this.visitors = this.options.visitors || defaultVisitors();
  }
  Filter.call(this, inputTree, this.options);
  this.ignoreRegExps = this.options.ignoredFiles.map(function(pattern) {
    return minimatch.makeRe(pattern);
  });
}

JSTransformPlugin.prototype.processFile = function (srcDir, destDir, relativePath) {
  var self = this;
  var string = fs.readFileSync(srcDir + '/' + relativePath, { encoding: 'utf8' });
  return Promise.resolve(self.processString(string, relativePath))
    .then(function(transformed) {
      var destFile = self.getDestFilePath(relativePath),
          outputPath = destDir + '/' + destFile,
          outputFiles = [destFile];
      if (self.options.sourceMap) {
        var sourceMap = transformed.sourceMap.toString();
        fs.writeFileSync(outputPath + ".map", sourceMap, { encoding: 'utf8' });
        transformed.code += "\n//# sourceMappingURL=" + path.basename(relativePath) + ".map";
        outputFiles.push(destFile + ".map");
      }
      fs.writeFileSync(outputPath, transformed.code, { encoding: 'utf8' });
      var cacheInfo = {
        inputFiles: [relativePath],
        outputFiles: outputFiles
      };
      return cacheInfo;
    });
}

JSTransformPlugin.prototype.processString = function(fileContents, relativePath) {
  try {
    this.options.filename = path.basename(relativePath);
    return jstransform.transform(this.visitors, fileContents, this.options);
  }
  catch(e) {
    e.message = "Call to jstransform.transform() failed for file '" + relativePath + "': " + e.message;
    throw e;
  }
  return fileContents;
};

JSTransformPlugin.prototype.canProcessFile = function(relativePath) {
  if (this.options.glob && !this.options.glob.test(relativePath)) return false;
  for (var i = 0; i < this.ignoreRegExps.length; i++) {
    if (this.ignoreRegExps[i].test(relativePath)) {
      return false;
    }
  }
  return true;
};

function defaultVisitors() {
  return jstransformVisitors([
    'es6-arrow-function',
    'es6-class',
    'es6-destructuring',
    'es6-object-concise-method',
    'es6-object-short-notation',
    'es6-rest-param',
    'es6-template',
    'es7-rest-property',
    'es7-spread-property',
    'reserved-words'
  ]);
}

function jstransformVisitors(transforms) {
  var visitors = [];
  transforms.forEach(function(transform) {
    var visitor = require('jstransform/visitors/' + transform + '-visitors');
    visitors = visitors.concat(visitor.visitorList);
  });
  return visitors;
}
