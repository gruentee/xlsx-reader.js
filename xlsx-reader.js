(function(undefined) {
    'use strict';
    // Check if dependecies are available.
    if (typeof XLSX === 'undefined') {
        console.log('xlsx.js is required. Get it from https://github.com/SheetJS/js-xlsx');
        return;
    }

    if (typeof _ === 'undefined') {
        console.log('Lodash.js is required. Get it from http://lodash.com/');
        return;
    }

    // Baseline setup
    // --------------

    // Establish the root object, `window` in the browser, or `exports` on the server.
    var root = this;

    // Save the previous value of the `XLSXReader` variable.
    var previousXLSXReader = root.XLSXReader;


    // Create a safe reference to the XLSXReader object for use below.
    var XLSXReader = function(file, readCells, toJSON, opts, handler) {
        var obj = {};
        XLSXReader.utils.intializeFromFile(obj, file, readCells, toJSON, opts, handler);
        return obj;
    }

    // Export the XLSXReader object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `XLSXReader` as a global object via a string identifier,
    // for Closure Compiler 'advanced' mode.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            var exports = module.exports = XLSXReader;
        }
        exports.XLSXReader = XLSXReader;
    } else {
        root.XLSXReader = XLSXReader;
    }

    function fixdata(data) {
        var o = "", l = 0, w = 10240;
        for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint8Array(data.slice(l*w,l*w+w)));
        o+=String.fromCharCode.apply(null, new Uint8Array(data.slice(l*w)));
        return o;
    }

    // IE >= 10 compat
    var rABS = typeof FileReader !== "undefined" && typeof FileReader.prototype !== "undefined" &&
        typeof FileReader.prototype.readAsBinaryString !== "undefined";

    XLSXReader.utils = {
        'intializeFromFile': function(obj, file, readCells, toJSON, opts, handler) {
            var reader = new FileReader();

            reader.onload = function(e) {
                var data = e.target.result;
                var workbook;
                if(rABS) {
                    workbook = XLSX.read(data, {
                        type: 'binary'
                    });
                } else {
                    var arr = fixdata(data);
                    workbook = XLSX.read(btoa(arr), {type: 'base64'});
                }

                obj.sheets = XLSXReader.utils.parseWorkbook(workbook, readCells, toJSON, opts);
                handler(obj);
            };

            reader.onerror = function(e) {
                e = e || window.event; // get window.event if e argument missing (in IE)
                var msg;
                switch (e.target.error.code) {
                    case e.target.error.NOT_FOUND_ERR:
                        msg = 'Datei nicht gefunden!';
                        break;
                    case e.target.error.NOT_READABLE_ERR:
                        msg = 'Datei nicht lesbar!';
                        break;
                    case e.target.error.ABORT_ERR:
                        msg = 'Lesevorgang wurde abgebrochen!';
                        break;
                    case e.target.error.SECURITY_ERR:
                        msg = 'Datei wird von einem anderen Programm verwendet!';
                        break;
                }
                handler(msg);
            };

            if(rABS) {
                reader.readAsBinaryString(file);
            } else {
                reader.readAsArrayBuffer(file);
            }

        },
        'parseWorkbook': function(workbook, readCells, toJSON, opts) {
            if (toJSON === true) {
                return XLSXReader.utils.to_json(workbook, opts);
            }

            var sheets = {};
            window.workbook = workbook;

            _.forEachRight(workbook.SheetNames, function(sheetName) {
                var sheet = workbook.Sheets[sheetName];
                sheets[sheetName] = XLSXReader.utils.parseSheet(sheet, readCells);
            });

            return sheets;
        },
        'parseSheet': function(sheet, readCells) {
            if (sheet['!ref'] === undefined) {
                return [];
            }

            var range = XLSX.utils.decode_range(sheet['!ref']);
            var sheetData = [];

            if (readCells === true) {
                _.forEachRight(_.range(range.s.r, range.e.r + 1), function(row) {
                    var rowData = [];
                    _.forEachRight(_.range(range.s.c, range.e.c + 1), function(column) {
                        var cellIndex = XLSX.utils.encode_cell({
                            'c': column,
                            'r': row
                        });
                        var cell = sheet[cellIndex];
                        if(cell.t === 's') cell.v = cell.v.trim();
                        // if(cell.w) cell.w = cell.w.trim();
                        rowData[column] = cell ? cell.v : undefined;
                    });
                    sheetData[row] = rowData;
                });
            }

            return {
                'data': sheetData,
                'name': sheet.name,
                'col_size': range.e.c + 1,
                'row_size': range.e.r + 1
            };
        },
        to_json: function(workbook, opts) {
            var result = {};
            workbook.SheetNames.forEach(function(sheetName) {
                var roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], opts);
                if (roa.length > 0) {
                    result[sheetName] = roa;
                }
            });
            return result;
        }
    };
}).call(this);