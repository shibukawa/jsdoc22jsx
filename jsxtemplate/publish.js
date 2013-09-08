/** Called automatically by JsDoc Toolkit. */
function publish(symbolSet)
{
    publish.conf = {  // trailing slash expected for dirs
        ext:         ".jsx",
        outDir:      JSDOC.opt.d || SYS.pwd+"../out/"
    };
    try
    {
        var json = read(symbolSet);
        write(json);
    }
    catch (e)
    {
        console.log(e.stack);
    }
}

function read(symbolSet)
{
    symbolSet.deleteSymbol("_global_");
    symbolSet.deleteSymbol("Error");

    // create the folders and subfolders to hold the output
    IO.mkPath((publish.conf.outDir).split("/"));

    // some ustility filters
    function hasNoParent($) {return ($.memberOf === "");}
    function isaFile($) {return ($.is("FILE"));}
    function isaClass($) {return ($.is("CONSTRUCTOR") || $.isNamespace);}

    var classes = symbolSet.toArray().filter(isaClass).sort(makeSortby("alias"));
    var masterGroup = {
        classes: {}
    };
    classes.forEach(function (classobj) {
        var currentGroup = masterGroup;
        var currentChildren = masterGroup.classes;
        var json = processData(classobj);
        var names = json.alias.split('.');
        while (names.length > 0)
        {
            groupName = names.shift();
            if (!currentChildren[groupName])
            {
                currentChildren[groupName] = {
                    classes: {},
                    name: groupName
                };
            }
            currentGroup = currentChildren[groupName];
            currentChildren = currentChildren[groupName].classes;
        }
        currentGroup.obj = json;
    });
    return masterGroup;
}

function write(json)
{
    //console.log(JSON.stringify(masterGroup, null, '    '));
    for (var key in json.classes)
    {
        if (json.classes.hasOwnProperty(key))
        {
            var sourceCode = dumpCode(json.classes[key]);
            IO.saveFile(publish.conf.outDir, key.toLowerCase() + publish.conf.ext, sourceCode);
        }
    }
}


function indent(num)
{
    result = [];
    for (var i = 0; i < num; i++)
    {
        result.push('    ');
    }
    return result.join('');
}

function convertType(type, classname)
{
    var typeConvert = {
        'String' : 'string',
        'Boolean' : 'boolean',
        'Number' : 'number',
        'Object' : 'variant',
        'this' : classname
    };
    var isArray = false;
    if (type.indexOf('[]') === type.length - 2)
    {
        isArray = true;
        type = type.slice(0, type.length - 2);
    }
    if (typeConvert.hasOwnProperty(type))
    {
        type = typeConvert[type];
    }
    return (isArray) ? type + '[]' : type;
}

function calcVariation(method, classname)
{
    var result = [[]];
    for (var i = 0; i < method.params.length; i++)
    {
        var newResult = [];
        var param = method.params[i];
        for (var j = 0; j < result.length; j++)
        {
            if (param.optional)
            {
                newResult.push(result[j].slice(0));
            }
            var typeNames = param.type.split('|');
            for (var k = 0; k < typeNames.length; k++)
            {
                var typeName = typeNames[k];
                if (param.name.indexOf('.') !== -1)
                {
                    continue;
                }
                var resultCopy = result[j].slice(0);
                resultCopy.push(param.name + " : " + convertType(typeName, classname));
                newResult.push(resultCopy);
            }
        }
        result = newResult;
    }
    return result;
}

function dumpMethod(method, code, depth, classname, isConstructor)
{
    var variations = calcVariation(method, classname);
    for (var j = 0; j < variations.length; j++)
    {
        if (method['static'])
        {
            code.push(indent(depth), 'static ');
        }
        else
        {
            code.push(indent(depth));
        }
        if (isConstructor)
        {
            code.push('function constructor (', variations[j].join(', '), ');\n');
        }
        else
        {
            var type = (method.returns.length === 0) ? 'void' : convertType(method.returns[0].type, classname);
            code.push('function ', method.name, ' (', variations[j].join(', '), ') : ', type, ';\n');
        }
    }
}


function dumpCode(json, code, depth)
{
    var initial = false;
    if (code === undefined)
    {
        initial = true;
        code = [];
        depth = 1;
        //console.log(JSON.stringify(json, null, '    '));
        code.push('class ', json.name, '\n');
        code.push('{\n');
    }
    for (var key in json.classes)
    {
        if (json.classes.hasOwnProperty(key))
        {
            code.push('\n');
            var group = json.classes[key];
            var obj = group.obj;
            if (obj['extends'].length === 0)
            {
                code.push(indent(depth), 'native class ', key, '\n');
            }
            else
            {
                code.push(indent(depth), 'native class ', key, ' extends ', obj['extends'][0], '\n');
            }
            code.push(indent(depth), '{\n');
            depth++;
            dumpMethod(obj.constructor, code, depth, key, true);
            for (var i = 0; i < obj.methods.length; i++)
            {
                dumpMethod(obj.methods[i], code, depth, key);
            }
            dumpCode(group, code, depth);
            depth--;
            code.push(indent(depth), '}\n');
        }
    }
    if (initial)
    {
        code.push('}\n');
    }
    return code.join('');
}


/** Make a symbol sorter by some attribute. */
function makeSortby(attribute) {
    return function(a, b) {
        if (a[attribute] !== undefined && b[attribute] !== undefined) {
            a = a[attribute].toLowerCase();
            b = b[attribute].toLowerCase();
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }
    };
}

function escapeQuate(str)
{
    return '"' + str.replace('"', '\\"') + '"';
}

function processData (data)
{
    var result = {
        name: data.name,
        alias: data.alias,
        builtin: Boolean(data.isBuiltin())
    };

    if (data.isNamespace)
    {
        result.namespace = true;
        result['function'] = Boolean(data.is('FUNCTION'));
        result['class'] = false;
    }
    else
    {
        result.namespace = false;
        result['function'] = false;
        result['class'] = true;
    }
    if (data.version)
    {
        result.version = data.version;
    }
    result['extends'] = data.augments.map(function (item) {
        return item.desc;
    });
    result.description = data.classDesc;
    if (!data.isBuiltin() && (data.isNamespace || data.is('CONSTRUCTOR')))
    {
        result.constructor = processMethod(data, true);
    }
    result.properties = data.properties.map(function (item) {
        return processProperty(item);
    });
    result.methods = data.getMethods().map(function (item) {
        return processMethod(item);
    });
    result.events = data.getEvents().map(function (item) {
        return processMethod(item);
    });
    return result;
}

function processMethod(data, isConstructor)
{
    var result = {};
    if (!isConstructor)
    {
        result.name = data.name;
        result['static'] = Boolean(data.isStatic);
        result.type = data.type;
        result.requires = data.requires.slice(0);
    }
    result.returns = data.returns.map(function (item) {
        return processSubType(item);
    });
    result.params = data.params.map(function (item) {
        return processSubType(item, "param");
    });
    result.exceptions = data.exceptions.map(function (item) {
        return processSubType(item, "exception");
    });
    processCommonData(result, data);
    return result;
}

function processProperty(data)
{
    var result = {};
    result['static'] = Boolean(data.isStatic);
    result.type = Boolean(data.type);
    result.name = Boolean(data.name);
    result.constant = Boolean(data.isConstant);
    if (data.defaultValue)
    {
        result.defaultValue = data.defaultValue;
    }
    processCommonData(result, data);
    return result;
}

function processCommonData(result, data)
{
    result.inner = Boolean(data.isInner);
    result['private'] = Boolean(data.isPrivate);
    result.description = data.desc;
    result.sourceFile = data.srcFile;
    result.examples = data.examples;
    if (data.author)
    {
        result.author = data.author;
    }
    if (data.deprecated)
    {
        result.deprecated = data.deprecated;
    }
    if (data.since)
    {
        result.since = data.since;
    }
    data.see = data.see.slice(0);
    return result;
}

function processSubType(data, type)
{
    var result = {
        type: data.type,
        description: data.desc
    };
    if (type === 'param')
    {
        result.name = data.name;
        result.optional = Boolean(data.isOptional);
        if (data.defaultValue)
        {
            result.defaultValue = data.defaultValue;
        }
    }
    else if (type === 'exception')
    {
        result.name = data.name;
    }
    return result;
}
