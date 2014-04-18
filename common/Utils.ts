///<reference path='../_references.d.ts'/>
import url                                          = require('url');
import log4js                                       = require('log4js');
import _                                            = require('underscore');

class Utils
{
    /* Get random string */
    static getRandomString(length:number, characters?:string)
    {
        var buf = [];
        var chars = characters || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

        for (var i = 0; i < length; ++i)
        {
            buf.push(chars[this.getRandomInt(0, length - 1)]);
        }

        return buf.join('');
    }

    /* Get random number */
    static getRandomInt(min, max)
    {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /*
     * Get a promise that'll get rejected in next tick
     *  Used when we need to cancel an operation for invalid input
     static getRejectedPromise(errorMessage:string):q.Promise<any>
     {
     var deferred = q.defer();
     process.nextTick(function fail() {
     deferred.reject(errorMessage);
     });
     return deferred.promise;
     }
     */

    static isNullOrEmpty(val:any):boolean
    {
        var objectType:string = this.getObjectType(val);
        if (objectType == 'Array' || objectType == 'String')
            return val.length == 0;
        if (objectType == 'Number' && isNaN(val))
            return true;
        else
            return val == null || val == undefined;
    }

    static getClassName(object:Object):string
    {
        var funcNameRegex = /function (.{1,})\(/;
        var results = (funcNameRegex).exec(object['constructor'].toString());
        return (results && results.length > 1) ? results[1] : "";
    }

    static copyProperties(source:any, target:any):void
    {
        for (var prop in source)
        {
            if (target[prop] !== undefined)
                target[prop] = source[prop];
            else
                log4js.getDefaultLogger().debug("Cannot set undefined property: " + prop);
        }
    }

    static camelToSnakeCase(camelCasedString:string):string
    {
        var frags:Array<string> = camelCasedString.match(/[A-Z][a-z]+/g);
        var lowerCasedFrags:Array<string> = _.map(frags, function (frag:string)
        {
            return frag.toLowerCase();
        })
        return lowerCasedFrags.join('_');
    }

    static snakeToCamelCase(snakeCasedString:string):string
    {
        var frags:Array<string> = snakeCasedString.toLowerCase().split('_');
        var camelCaseFrags:Array<string> = _.map(frags, function (frag:string)
        {
            return frag.replace(/^([a-z])/, function (m:string, p1):string { return p1.toUpperCase(); });
        });
        return camelCaseFrags.join('');
    }

    static snakeCaseToNormalText(snakeCasedString:string):string
    {
        snakeCasedString = snakeCasedString.replace(/_/g, ' ');
        snakeCasedString = snakeCasedString.toLowerCase();
        snakeCasedString = snakeCasedString.replace(/(^[a-z]|\s[a-z])/g, function (m:string, p):string { return m.toUpperCase(); })
        return snakeCasedString;
    }

    static enumToNormalText(enumObject:Object)
    {
        for (var key in enumObject)
        {
            var value = enumObject[key];
            if (Utils.getObjectType(value) == 'String')
                enumObject[key] = Utils.snakeCaseToNormalText(value);
        }
        return enumObject;
    }

    static getObjectType(obj:any):string
    {
        var type:string = Object.prototype.toString.call(obj).replace('[object ', '').replace(']', '');
        return type === 'Object' ? obj.toString().replace('[object ', '').replace(']', '') : type;
    }

    static surroundWithQuotes(val:any):string
    {
        if (Utils.getObjectType(val) == 'String')
            return "'" + val + "'";
        return val;
    }

    static createSimpleObject(key:string, value:any):Object
    {
        var obj:Object = {};
        if (!Utils.isNullOrEmpty(key))
            obj[key] = value;
        return obj;
    }

    static repeatChar(char:string, times:number, delimiter:string = ''):string
    {
        if (times <= 1)
            return char;

        if (char.trim().length > 1)
        {
            var repeatArray = [];
            for (var i = 0; i < times; i++)
                repeatArray.push(char);
            return repeatArray.join(delimiter);
        }

        var repeatString:string = Array(times + 1).join(char);
        return delimiter === '' ? repeatString : repeatString.split('').join(delimiter);
    }

    static escapeHTML(s:string):string
    {
        return s.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    static unescapeHTML(s:string):string
    {
        return s.replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }

    static addQueryToUrl(baseUrl:string, query:Object):string
    {
        var urlObj = url.parse(baseUrl);
        urlObj.query = _.extend(urlObj.query || {}, query);
        return url.format(urlObj);
    }
}
export = Utils