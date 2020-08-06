#!/usr/bin/env node
var glob = require('glob'),
    fs = require('fs'),
    cp = require('child_process');
    
function build() {
  let configPath = process.argv[3];

  if (!configPath) {
    throw new Error("No webpack config provided")
  }

  return new Promise((resolve, reject) => {
    cp.exec(`node_modules/webpack/bin/webpack.js --config ${configPath} --json --display-used-exports > stats.json`, (err, stdout) => {
      err ? 
        reject(err) : 
        resolve(); 
    });
  })
}

function scanDirs() {
  let root = process.argv[2];

  if (!root) {
    throw new Error("No target folder provided")
  }

  return new Promise((resolve, reject) => {
    glob(root + '/**/*.*', function (err, res) {
      err ? 
        reject(err) : 
        resolve(res);
    })
  })
}

function grabModules() {
  let data = fs.readFileSync('./stats.json', { encoding:'utf8' }),
      stats = JSON.parse(data),
      modules = {};

  function traverse(item) {
    if (item.modules) {
      item.modules.forEach(module => {
        modules[module.name] = {
          usedExports: module.usedExports,
          providedExports: module.providedExports
        } 

        traverse(module)
      })
    }
  }

  stats.children.forEach(child => {
    traverse(child);
  });

  return modules;
}

function checkUnused(files, modules) {
  let unused = {
    files: {},
    exports: {}
  };

  files.filter(item => !/test/.test(item)).forEach(file => {
    if (!modules[file]) {
      unused.files[file] = true
    } 
  });

  Object.keys(modules).forEach(file => {
    if (!unused.files[file]) {
      let mod = modules[file];

      if (mod.providedExports && mod.providedExports.length)  {
        mod.providedExports.forEach(exp => {
          if(Array.isArray(mod.usedExports) &&  mod.usedExports.indexOf(exp) < 0) {
            unused.exports[file] = unused.exports[file] || [];
            unused.exports[file].push(exp);
          }
        })
      }
    }
  });

  return unused;
}

function viewReport(unused) {
  let fileNames = Object.keys(unused.files),
      exportsSrc = Object.keys(unused.exports)

  if (!!fileNames.length) {
    console.log('\nUnused files');
    console.table(fileNames);
  }

  if (!!exportsSrc.length) {
    console.log('\nUnused exports');
    
    exportsSrc.forEach(src => {
      console.log(`-------------\n\n${src}\n${unused.exports[src].join('\n')}\n-------------`);
    });
  }
}

if (process.argv[2] == '--help' || process.argv[2] == '-h' ) {
  console.log(`
    Util to find unused files and export in webpack based project

    Usage
      
      wp-unused ./path/to/your/webpack.config.js

    Warnings!
      
      - Be carefull on delete and check twise!
      - Doesn't work for array webpack.configs
  `)
} else {

  Promise.all([build(), scanDirs()])
    .then(([_, files]) => {
     
      let modules = grabModules(),
          unused = checkUnused(files, modules);

      viewReport(unused); 
    })
    .catch(err => {
      throw err
    })
}
