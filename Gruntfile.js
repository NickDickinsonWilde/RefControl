module.exports = function (grunt) {
    "use strict";
    var srcDir = "source/",
        distDir = "dist/",
        tempDir = distDir + "temp/",
        srcFiles = {
            js: ["**/*.js"],
            images : ["**/*.png"],
            css: ["**/*.css"],
            xul: ["**/*.xul"],
            locales: ["chrome/locale/**/*"],
            pkg: ["install.rdf", "license.txt", "chrome.manifest", "CHANGELOG"],
            dev: ["package.json", "Gruntfile.js"]
        },
        pkg = grunt.file.readJSON('package.json');
    srcFiles.releaseFiles = [srcFiles.js, srcFiles.images, srcFiles.css, srcFiles.xul, srcFiles.locales, srcFiles.pkg];

    grunt.initConfig({
      // Metadata.
        pkg: pkg,
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
            ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
        // Task configuration.
        clean: {
            common: [tempDir, distDir]
        },
        copy: {
            common: {
                files: [
                    {
                        expand: true,
                        cwd: srcDir,
                        dest: tempDir,
                        src: [srcFiles.releaseFiles]
                    }
                ]
            },
            dev: {
                files: [
                    {
                        expand: true,
                        cwd: srcDir,
                        dest: tempDir,
                        src: [srcFiles.dev]
                    }
                ]
            }
        },
        cssmin: {
            minify: {
                options: {
                    report: 'gzip'
                },
                files: [{
                    expand: true,
                    cwd: tempDir,
                    src: srcFiles.css,
                    dest: distDir,
                    ext: '.css'
                }]
            }
        },
        uglify: {
            //options: {
            //    banner: '<%= banner %>'
            //},
            minify: {
                files: [{
                    expand: true,
                    cwd: tempDir,
                    src: srcFiles.js,
                    dest: distDir,
                    ext: '.js'
                }]
            }
        },
        jshint: {
            common: {
                files: [{
                    expand: true,
                    cwd: srcDir,
                    src: srcFiles.js
                }]
            }
        },
    });
    require('time-grunt')(grunt);
    require('load-grunt-tasks')(grunt);


    grunt.registerTask('default', ['clean', 'jshint', 'copy', 'cssmin', 'uglify:minify']);

};
