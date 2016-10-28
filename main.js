/*jshint node:true, bitwise:false */
/**
 *
 * Node Console Stripe by Ståle Raknes
 *
 */

"use strict";

var defaultDateFormat = require( "dateformat" );
var merge = require( "merge" );
var chalk = require( "chalk" );
var defaults = require( "./defaults.json" );
var util = require( 'util' );
var stripe = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.blue,
    log: function(str){
        return str;
    }
};

var levelPriorities = {
    log: 4,
    info: 3,
    warn: 2,
    error: 1,
    assert: 2,
    dir: 4
};

function getAllowedLogFunctions( level ) {
    var logFunctions = [],
        levelPriority = levelPriorities[level];

    for ( var logFunction in levelPriorities ) {
        if ( levelPriorities.hasOwnProperty( logFunction ) ) {
            if ( levelPriority >= levelPriorities[logFunction] ) {
                logFunctions.push( logFunction );
            }
        }

    }

    return logFunctions;
}

module.exports = function ( con, options, prefix_metadata ) {

    // If the console is patched already, restore it
    if ( con.__ts__ && "restoreConsole" in con ) {
        con.restoreConsole();
    }

    var pattern;

    if ( typeof options === "string" ) {
        // Fallback to version 0.1.x
        pattern = options;
        options = merge( {}, defaults );
    } else {
        options = merge( {}, defaults, (options || {}) );
        pattern = options.pattern;
        prefix_metadata = prefix_metadata || options.metadata;
    }

    var stdout = options.stdout;
    var stderr = options.stderr || options.stdout;

    var dateFormat = options.formatter || defaultDateFormat,
        allowedLogFunctions = getAllowedLogFunctions( options.level );

    options.disable = options.disable.concat( options.include.filter( function ( m ) {
        return !~options.exclude.indexOf( m ) && !~allowedLogFunctions.indexOf( m );
    } ) );

    options.include = options.include.filter( function filter( m ) {
        return !~options.exclude.indexOf( m ) && !~options.disable.indexOf( m );
    } );

    var original_functions = [];

    var slice = Array.prototype.slice;

    options.include.forEach( function ( f ) {

        original_functions.push( [f, con[f]] );

        var org = con[f];

        con[f] = function () {

            var stColor;

            switch (f){
                case "error":
                case "warn":
                case "info":
                    stColor = stripe[f];
                    break;
                default:
                    stColor = stripe.log;
            }

            var prefix = stColor( "[" + dateFormat( pattern ) + "]" ) + " ";
            var args = slice.call( arguments );

            // Add label if flag is set
            if ( options.label ) {
                prefix += stColor( "[" + f.toUpperCase() + "]" ) + "      ".substr( f.length );
            }

            // Add metadata if any
            var metadata = "";
            if ( typeof prefix_metadata === 'function' ) {
                metadata = prefix_metadata( f, args );
            } else if ( typeof prefix_metadata === 'object' ) {
                metadata = util.inspect( prefix_metadata );
            } else if ( typeof prefix_metadata !== 'undefined' ) {
                metadata = prefix_metadata;
            }

            if ( metadata ) {
                prefix += stColor( metadata ) + " "; //Metadata
            }

            if ( f === "error" || f === "warn" || ( f === "assert" && !args[0] ) ) {
                ( stderr || process.stderr ).write( prefix );
            } else if ( f !== "assert" ) {
                ( stdout || process.stdout ).write( prefix );
            }

            args.forEach(function(str,index){
                args[index] = stColor(str);
            });

            return org.apply( con, args );

        };
    } );

    options.disable.forEach( function ( f ) {

        original_functions.push( [f, con[f]] );

        con[f] = function () { };

    } );

    con.restoreConsole = function () {
        original_functions.forEach( function ( pair ) {
            con[pair[0]] = pair[1];
            delete con.__ts__;
        } );
        delete con.restoreConsole;
    };

    con.__ts__ = true;

};
