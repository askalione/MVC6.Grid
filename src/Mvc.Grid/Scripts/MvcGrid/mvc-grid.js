﻿/*!
 * Mvc.Grid 4.0.0
 * https://github.com/NonFactors/MVC6.Grid
 *
 * Copyright © NonFactors
 *
 * Licensed under the terms of the MIT License
 * http://www.opensource.org/licenses/mit-license.php
 */
var MvcGrid = (function () {
    function MvcGrid(element, options) {
        options = options || {};
        element = this.findGrid(element);
        if (element.dataset.id) {
            return this.instances[parseInt(element.dataset.id)].set(options);
        }

        var grid = this;
        grid.columns = [];
        grid.element = element;
        grid.loadingDelay = 300;
        grid.showLoading = true;
        grid.requestType = 'get';
        grid.name = element.dataset.name;
        grid.popup = new MvcGridPopup(grid);
        grid.filterMode = element.dataset.filterMode;
        grid.prefix = grid.name ? grid.name + '-' : '';
        grid.sourceUrl = grid.element.dataset.sourceUrl;
        grid.element.dataset.id = options.id || grid.instances.length;
        grid.filters = {
            'enum': MvcGridEnumFilter,
            'date': MvcGridDateFilter,
            'guid': MvcGridGuidFilter,
            'text': MvcGridTextFilter,
            'number': MvcGridNumberFilter,
            'boolean': MvcGridBooleanFilter
        };

        var rowFilters = element.querySelectorAll('.mvc-grid-row-filters th');
        [].forEach.call(element.querySelectorAll('.mvc-grid-headers th'), function (header, i) {
            grid.columns.push(new MvcGridColumn(grid, header, rowFilters[i]));
        });

        var pager = element.querySelector('.mvc-grid-pager');
        if (pager) {
            grid.pager = new MvcGridPager(grid, pager);
        }

        if (options.id) {
            grid.instances[parseInt(options.id)] = grid;
        } else {
            grid.instances.push(grid);
        }

        grid.set(options);
        grid.cleanUp();
        grid.bind();

        if (grid.sourceUrl && !element.children.length) {
            grid.reload();
        }
    }

    MvcGrid.prototype = {
        instances: [],
        lang: {
            text: {
                'contains': 'Contains',
                'equals': 'Equals',
                'not-equals': 'Not equals',
                'starts-with': 'Starts with',
                'ends-with': 'Ends with'
            },
            number: {
                'equals': 'Equals',
                'not-equals': 'Not equals',
                'less-than': 'Less than',
                'greater-than': 'Greater than',
                'less-than-or-equal': 'Less than or equal',
                'greater-than-or-equal': 'Greater than or equal'
            },
            date: {
                'equals': 'Equals',
                'not-equals': 'Not equals',
                'earlier-than': 'Earlier than',
                'later-than': 'Later than',
                'earlier-than-or-equal': 'Earlier than or equal',
                'later-than-or-equal': 'Later than or equal'
            },
            enum: {
                'equals': 'Equals',
                'not-equals': 'Not equals'
            },
            guid: {
                'equals': 'Equals',
                'not-equals': 'Not equals'
            },
            boolean: {
                'equals': 'Equals',
                'not-equals': 'Not equals'
            },
            filter: {
                'apply': '&#10004;',
                'remove': '&#10008;'
            },
            operator: {
                'select': '',
                'and': 'and',
                'or': 'or'
            }
        },

        findGrid: function (element) {
            var grid = element;

            while (grid && !grid.classList.contains('mvc-grid')) {
                grid = grid.parentElement;
            }

            if (!grid) {
                throw new Error('Grid can only be created from within mvc-grid structure.');
            }

            return grid;
        },

        set: function (options) {
            var grid = this;
            var filters = options.filters || {};

            for (var key in filters) {
                grid.filters[key] = filters[key];
            }

            grid.columns.forEach(function (column) {
                if (column.filter && (filters.hasOwnProperty(column.filter.name) || !column.filter.instance)) {
                    column.filter.instance = new grid.filters[column.filter.name](column);
                    column.filter.instance.init();
                }
            });

            grid.requestType = options.requestType || grid.requestType;
            grid.sourceUrl = options.sourceUrl === undefined ? grid.sourceUrl : options.sourceUrl;
            grid.showLoading = options.showLoading === undefined ? grid.showLoading : options.showLoading;
            grid.loadingDelay = options.loadingDelay === undefined ? grid.loadingDelay : options.loadingDelay;

            if (grid.sourceUrl) {
                var urlsParts = grid.sourceUrl.split('?', 2);
                grid.sourceUrl = urlsParts[0];

                if (options.query !== undefined) {
                    grid.query = new MvcGridQuery(options.query);
                } else if (urlsParts[1] || !grid.query) {
                    grid.query = new MvcGridQuery(urlsParts[1]);
                }
            } else if (options.query !== undefined) {
                grid.query = new MvcGridQuery(options.query);
            } else {
                grid.query = new MvcGridQuery(window.location.search);
            }

            return this;
        },

        reload: function () {
            var grid = this;

            grid.element.dispatchEvent(new CustomEvent('reloadstart', {
                detail: { grid: grid },
                bubbles: true
            }));

            if (grid.sourceUrl) {
                grid.startLoading(function (result) {
                    var i = -1;
                    var parent = grid.element.parentElement;
                    while (parent.children[++i] != grid.element);

                    grid.element.outerHTML = result;

                    var newGrid = new MvcGrid(parent.children[i], {
                        loadingDelay: grid.loadingDelay,
                        showLoading: grid.showLoading,
                        requestType: grid.requestType,
                        query: grid.query.toString(),
                        id: grid.element.dataset.id,
                        sourceUrl: grid.sourceUrl,
                        filters: grid.filters
                    });

                    newGrid.element.dispatchEvent(new CustomEvent('reloadend', {
                        detail: { grid: newGrid },
                        bubbles: true
                    }));
                }, function (result) {
                    grid.element.dispatchEvent(new CustomEvent('reloadfail', {
                        detail: { grid: grid, result: result },
                        bubbles: true
                    }));
                });
            } else {
                window.location.href = window.location.origin + window.location.pathname + '?' + grid.query;
            }
        },
        startLoading: function (success, error) {
            var grid = this;

            grid.stopLoading();
            if (grid.showLoading && !grid.element.querySelector('.mvc-grid-loader')) {
                var content = document.createElement('div');
                content.appendChild(document.createElement('div'));
                content.appendChild(document.createElement('div'));
                content.appendChild(document.createElement('div'));

                grid.loader = document.createElement('div');
                grid.loader.className = 'mvc-grid-loader';
                grid.loader.appendChild(content);

                grid.loading = setTimeout(function () {
                    grid.loader.classList.add('mvc-grid-loading');
                }, grid.loadingDelay);

                grid.element.appendChild(grid.loader);
            }

            grid.request = new XMLHttpRequest();
            grid.request.open(grid.requestType, grid.sourceUrl + '?' + grid.query + '&_=' + Date.now(), true);
            grid.request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

            grid.request.onload = function () {
                if (200 <= grid.request.status && grid.request.status < 400) {
                    success(grid.request.responseText);
                } else if (error) {
                    error(grid.request.responseText);
                }
            };

            grid.request.onerror = error;

            grid.request.send();
        },
        stopLoading: function () {
            var grid = this;

            if (grid.request && grid.request.readyState != 4) {
                grid.request.abort();
            }

            clearTimeout(grid.loading);

            if (grid.loader) {
                grid.loader.parentElement.removeChild(grid.loader);
            }
        },

        bind: function () {
            var grid = this;

            [].forEach.call(grid.element.querySelectorAll('tbody tr'), function (row) {
                if (!row.classList.contains('mvc-grid-empty-row')) {
                    row.addEventListener('click', function (e) {
                        var data = {};

                        grid.columns.forEach(function (column, i) {
                            data[column.name] = row.cells[i].innerText;
                        });

                        this.dispatchEvent(new CustomEvent('rowclick', {
                            detail: { grid: grid, data: data, originalEvent: e },
                            bubbles: true
                        }));
                    });
                }
            });
        },

        cleanUp: function () {
            delete this.element.dataset.sourceUrl;
            delete this.element.dataset.filterMode;
        }
    };

    return MvcGrid;
})();

var MvcGridColumn = (function () {
    function MvcGridColumn(grid, header, rowFilter) {
        var column = this;
        var data = header.dataset;

        column.grid = grid;
        column.header = header;
        column.name = data.name;
        column.rowFilter = rowFilter;

        if (data.filter == 'True') {
            var options = header.querySelector('.mvc-grid-options');
            if (options) {
                options.parentElement.removeChild(options);
            } else if (grid.filterMode == 'FilterRow') {
                options = rowFilter.querySelector('select.mvc-grid-value');
            }

            column.filter = {
                isApplied: data.filterFirstMethod != '' || data.filterSecondMethod != '',
                hasOptions: options && options.children.length > 0,
                isMulti: data.filterMulti == 'True',
                operator: data.filterOperator,
                name: data.filterName,
                options: options,
                first: {
                    method: data.filterFirstMethod,
                    value: data.filterFirstValue
                },
                second: {
                    method: data.filterSecondMethod,
                    value: data.filterSecondValue
                }
            };
        }

        if (data.sort == 'True' && grid.filterMode != 'HeaderRow') {
            column.sort = {
                first: data.sortFirst,
                order: data.sortOrder
            };
        }

        column.bindFilter();
        column.bindSort();
        column.cleanUp();
    }

    MvcGridColumn.prototype = {
        cancelFilter: function () {
            if (this.filter.isApplied) {
                var grid = this.grid;

                grid.query.delete(grid.prefix + 'page');
                grid.query.delete(grid.prefix + 'rows');
                grid.query.deleteStartingWith(grid.prefix + this.name + '-');

                grid.reload();
            } else {
                this.filter.first.value = '';
                this.filter.second.value = '';
            }
        },
        applyFilter: function () {
            var grid = this.grid;

            grid.query.delete(grid.prefix + 'page');
            grid.query.delete(grid.prefix + 'rows');
            grid.query.deleteStartingWith(grid.prefix + this.name + '-');

            grid.query.append(grid.prefix + this.name + '-' + this.filter.first.method, this.filter.first.value);
            if (grid.filterMode == 'ExcelRow' && this.filter.isMulti) {
                grid.query.append(grid.prefix + this.name + '-op', this.filter.operator);
                grid.query.append(grid.prefix + this.name + '-' + this.filter.second.method, this.filter.second.value);
            }

            if (grid.pager && grid.pager.showPageSizes) {
                grid.query.append(grid.prefix + 'rows', grid.pager.rowsPerPage.value);
            }

            grid.reload();
        },
        applySort: function () {
            var column = this;
            var grid = this.grid;

            grid.query.delete(grid.prefix + 'sort');
            grid.query.delete(grid.prefix + 'order');
            grid.query.append(grid.prefix + 'sort', this.name);

            var order = column.sort.order == 'asc' ? 'desc' : 'asc';
            if (!column.sort.order && column.sort.first) {
                order = column.sort.first;
            }

            grid.query.append(grid.prefix + 'order', order);

            grid.reload();
        },

        bindFilter: function () {
            var column = this;

            if (column.filter) {
                var filter = (column.rowFilter || column.header).querySelector('.mvc-grid-filter');
                filter.addEventListener('click', function () {
                    column.filter.instance.show();
                });
            }
        },
        bindSort: function () {
            var column = this;

            if (column.sort) {
                column.header.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('mvc-grid-filter')) {
                        column.applySort();
                    }
                });
            }
        },

        cleanUp: function () {
            var data = this.header.dataset;

            delete data.filterSecondMethod;
            delete data.filterSecondValue;
            delete data.filterFirstMethod;
            delete data.filterFirstValue;
            delete data.filterOperator;
            delete data.filterMulti;
            delete data.filterName;
            delete data.filter;

            delete data.sortOrder;
            delete data.sortFirst;
            delete data.sort;

            delete data.name;
        }
    };

    return MvcGridColumn;
})();

var MvcGridPager = (function () {
    function MvcGridPager(grid, element) {
        var pager = this;

        pager.grid = grid;
        pager.element = element;
        pager.pages = element.querySelectorAll('[data-page]');
        pager.showPageSizes = element.dataset.showPageSizes == 'True';
        pager.rowsPerPage = element.querySelector('.mvc-grid-pager-rows');
        pager.currentPage = pager.pages.length ? parseInt(element.querySelector('.active').dataset.page) : 1;

        pager.cleanUp();
        pager.bind();
    }

    MvcGridPager.prototype = {
        apply: function (page) {
            var grid = this.grid;

            grid.query.delete(grid.prefix + 'page');
            grid.query.delete(grid.prefix + 'rows');

            grid.query.append(grid.prefix + 'page', page);

            if (this.showPageSizes) {
                grid.query.append(grid.prefix + 'rows', this.rowsPerPage.value);
            }

            grid.reload();
        },

        bind: function () {
            var pager = this;

            [].forEach.call(pager.pages, function (page) {
                page.addEventListener('click', function () {
                    pager.apply(this.dataset.page);
                });
            });

            pager.rowsPerPage.addEventListener('change', function () {
                pager.apply(pager.currentPage);
            });
        },

        cleanUp: function () {
            delete this.element.dataset.showPageSizes;
        }
    };

    return MvcGridPager;
})();

var MvcGridPopup = (function () {
    function MvcGridPopup(grid) {
        this.element.className = 'mvc-grid-popup';
        this.grid = grid;

        this.bind();
    }

    MvcGridPopup.prototype = {
        element: document.createElement('div'),

        render: function (filter) {
            this.element.className = ('mvc-grid-popup ' + filter.cssClasses).trim();
            this.element.innerHTML = filter.render();

            this.updateValues(filter.column);
        },
        updatePosition: function (column) {
            var filter = (column.rowFilter || column.header).querySelector('.mvc-grid-filter');
            var arrow = this.element.querySelector('.popup-arrow');
            var filterPos = filter.getBoundingClientRect();
            var width = this.element.clientWidth;

            var top = window.pageYOffset + filterPos.top + filter.offsetHeight * 0.6 + arrow.offsetHeight;
            var left = window.pageXOffset + filterPos.left - 8;
            var arrowLeft = filter.offsetWidth / 2;

            if (left + width + 8 > window.pageXOffset + document.documentElement.clientWidth) {
                var offset = width - filter.offsetWidth - 16;
                arrowLeft += offset;
                left -= offset;
            }

            this.element.style.left = left + 'px';
            this.element.style.top = top + 'px';
            arrow.style.left = arrowLeft + 'px';
        },
        updateValues: function (column) {
            var filter = column.filter;

            this.updateValue('.mvc-grid-operator', filter.operator);
            this.updateValue('.mvc-grid-value[data-filter="first"]', filter.first.value);
            this.updateValue('.mvc-grid-value[data-filter="second"]', filter.second.value);
            this.updateValue('.mvc-grid-method[data-filter="first"]', filter.first.method);
            this.updateValue('.mvc-grid-method[data-filter="second"]', filter.second.method);
        },
        updateValue: function (selector, value) {
            var input = this.element.querySelector(selector);

            if (input) {
                input.value = value;
            }
        },

        show: function (column) {
            if (!this.element.parentElement) {
                document.body.appendChild(this.element);
            }

            this.updatePosition(column);
        },
        hide: function (e) {
            var target = e && e.target;

            while (target && !/mvc-grid-(popup|filter)/.test(target.className)) {
                target = target.parentElement;
            }

            if (!target && MvcGridPopup.prototype.element.parentNode) {
                document.body.removeChild(MvcGridPopup.prototype.element);
            }
        },

        bind: function () {
            window.addEventListener('click', this.hide);
            window.addEventListener('resize', this.hide);
        }
    };

    return MvcGridPopup;
})();

var MvcGridQuery = (function () {
    function MvcGridQuery(value) {
        this.query = (value || '').replace('?', '');
    }

    MvcGridQuery.prototype = {
        set: function (name, value) {
            this.delete(name);
            this.append(name, value);
        },

        append: function (name, value) {
            this.query += this.query ? '&' : '';
            this.query += encodeURIComponent(name) + '=' + encodeURIComponent(value || '');
        },
        delete: function (name) {
            name = encodeURIComponent(name);

            this.query = this.query.split('&').filter(function (parameter) {
                return parameter.split('=', 1)[0] != name;
            }).join('&');
        },
        deleteStartingWith: function (name) {
            name = encodeURIComponent(name);

            this.query = this.query.split('&').filter(function (parameter) {
                return parameter.split('=', 1)[0].indexOf(name);
            }).join('&');
        },

        toString: function () {
            return this.query;
        }
    };

    return MvcGridQuery;
})();

function MvcGridExtends(subclass, base) {
    Object.setPrototypeOf(subclass, base);

    function Subclass() {
        this.constructor = subclass;
    }

    subclass.prototype = (Subclass.prototype = base.prototype, new Subclass());
}

var MvcGridFilter = (function () {
    function MvcGridFilter(column) {
        this.isMulti = column.filter.isMulti;
        this.mode = column.grid.filterMode;
        this.popup = column.grid.popup;
        this.cssClasses = '';
        this.column = column;
        this.methods = [];
    }

    MvcGridFilter.prototype = {
        init: function () {
            var filter = this;
            var column = filter.column;

            if (column.filter.hasOptions) {
                if (filter.mode == 'FilterRow') {
                    column.rowFilter.querySelector('select').addEventListener('change', function () {
                        column.filter.first.value = this.value;

                        filter.apply();
                    });
                } else if (filter.mode == 'HeaderRow') {
                    var value = column.rowFilter.querySelector('.mvc-grid-value');
                    value.readOnly = true;
                    value.tabIndex = -1;
                }
            } else if (filter.mode != 'ExcelRow') {
                var input = column.rowFilter.querySelector('.mvc-grid-value');

                input.addEventListener('input', function () {
                    column.filter.first.value = this.value;

                    filter.validate(this);
                });

                input.addEventListener('keyup', function (e) {
                    if (e.which == 13) {
                        filter.apply();
                    }
                });

                filter.validate(input);
            }

            column.filter.first.method = column.filter.first.method || filter.methods[0];
            column.filter.second.method = column.filter.second.method || filter.methods[0];
        },

        show: function () {
            var filter = this;

            filter.popup.render(filter);

            filter.bindOperator();
            filter.bindMethods();
            filter.bindValues();
            filter.bindActions();

            filter.popup.show(filter.column);
        },

        render: function () {
            this.lang = this.column.grid.lang;

            return '<div class="popup-arrow"></div>' +
                '<div class="popup-content">' +
                    '<div class="popup-filter">' +
                        this.renderFilter('first') +
                    '</div>' +
                    (this.mode == 'ExcelRow' && this.isMulti
                        ? this.renderOperator() +
                        '<div class="popup-filter">' +
                            this.renderFilter('second') +
                        '</div>'
                        : '') +
                    this.renderActions() +
                '</div>';
        },
        renderFilter: function (name) {
            var hasOptions = this.column.filter.hasOptions;
            var lang = this.lang[this.column.filter.name] || {};

            return '<div class="popup-group">' +
                       '<select class="mvc-grid-method" data-filter="' + name + '">' +
                           this.methods.map(function (method) {
                               return '<option value="' + method + '">' + (lang[method] || '') + '</option>';
                           }).join('') +
                       '</select>' +
                   '</div>' +
                   '<div class="popup-group">' + (hasOptions
                       ? '<select class="mvc-grid-value" data-filter="' + name + '">' +
                           this.column.filter.options.innerHTML +
                       '</select>'
                       : '<input class="mvc-grid-value" data-filter="' + name + '">') +
                   '</div>';
        },
        renderOperator: function () {
            return '<div class="popup-operator">' +
                       '<div class="popup-group">' +
                           '<select class="mvc-grid-operator">' +
                               '<option value="">' + this.lang.operator.select + '</option>' +
                               '<option value="and">' + this.lang.operator.and + '</option>' +
                               '<option value="or">' + this.lang.operator.or + '</option>' +
                           '</select>' +
                       '</div>' +
                   '</div>';
        },
        renderActions: function () {
            return '<div class="popup-actions">' +
                       '<button class="mvc-grid-apply" type="button">' + this.lang.filter.apply + '</button>' +
                       '<button class="mvc-grid-cancel" type="button">' + this.lang.filter.remove + '</button>' +
                   '</div>';
        },

        apply: function () {
            this.popup.hide();

            this.column.applyFilter();
        },
        cancel: function () {
            this.popup.hide();

            this.column.cancelFilter();
        },
        isValid: function () {
            return true;
        },
        validate: function (input) {
            if (this.isValid(input.value)) {
                input.classList.remove('invalid');
            } else {
                input.classList.add('invalid');
            }
        },

        bindOperator: function () {
            var filter = this.column.filter;
            var operator = this.popup.element.querySelector('.mvc-grid-operator');

            if (operator) {
                operator.addEventListener('change', function () {
                    filter.operator = this.value;
                });
            }
        },
        bindMethods: function () {
            var filter = this.column.filter;

            [].forEach.call(this.popup.element.querySelectorAll('.mvc-grid-method'), function (method) {
                method.addEventListener('change', function () {
                    filter[this.dataset.filter].method = this.value;
                });
            });
        },
        bindValues: function () {
            var filter = this;

            [].forEach.call(filter.popup.element.querySelectorAll('.mvc-grid-value'), function (input) {
                input.addEventListener('input', function () {
                    filter.column.filter[this.dataset.filter].value = this.value;

                    if (filter.mode != 'ExcelRow') {
                        var rowInput = filter.column.rowFilter.querySelector('.mvc-grid-value');
                        if (this.tagName == "SELECT") {
                            rowInput.value = this.options[this.selectedIndex].text;
                        } else {
                            rowInput.value = this.value;
                        }

                        filter.validate(rowInput);
                    }

                    filter.validate(this);
                });

                input.addEventListener('keyup', function (e) {
                    if (e.which == 13) {
                        filter.apply();
                    }
                });

                filter.validate(input);
            });
        },
        bindActions: function () {
            var popup = this.popup.element;

            popup.querySelector('.mvc-grid-apply').addEventListener('click', this.apply.bind(this));
            popup.querySelector('.mvc-grid-cancel').addEventListener('click', this.cancel.bind(this));
        }
    };

    return MvcGridFilter;
})();

var MvcGridTextFilter = (function (base) {
    MvcGridExtends(MvcGridTextFilter, base);

    function MvcGridTextFilter(column) {
        base.call(this, column);

        this.methods = ['contains', 'equals', 'not-equals', 'starts-with', 'ends-with'];
    }

    return MvcGridTextFilter;
})(MvcGridFilter);

var MvcGridNumberFilter = (function (base) {
    MvcGridExtends(MvcGridNumberFilter, base);

    function MvcGridNumberFilter(column) {
        base.call(this, column);

        this.methods = ['equals', 'not-equals', 'less-than', 'greater-than', 'less-than-or-equal', 'greater-than-or-equal'];
    }

    MvcGridNumberFilter.prototype.isValid = function (value) {
        return !value || /^(?=.*\d+.*)[-+]?\d*[.,]?\d*$/.test(value);
    };

    return MvcGridNumberFilter;
})(MvcGridFilter);

var MvcGridDateFilter = (function (base) {
    MvcGridExtends(MvcGridDateFilter, base);

    function MvcGridDateFilter(column) {
        base.call(this, column);

        this.methods = ['equals', 'not-equals', 'earlier-than', 'later-than', 'earlier-than-or-equal', 'later-than-or-equal'];
    }

    return MvcGridDateFilter;
})(MvcGridFilter);

var MvcGridEnumFilter = (function (base) {
    MvcGridExtends(MvcGridEnumFilter, base);

    function MvcGridEnumFilter(column) {
        base.call(this, column);

        this.methods = ['equals', 'not-equals'];
    }

    return MvcGridEnumFilter;
})(MvcGridFilter);

var MvcGridGuidFilter = (function (base) {
    MvcGridExtends(MvcGridGuidFilter, base);

    function MvcGridGuidFilter(column) {
        base.call(this, column);

        this.methods = ['equals', 'not-equals'];
        this.cssClasses = 'mvc-grid-guid-filter';
    }

    MvcGridGuidFilter.prototype.isValid = function (value) {
        return !value || /^[0-9A-F]{8}[-]?([0-9A-F]{4}[-]?){3}[0-9A-F]{12}$/i.test(value);
    };

    return MvcGridGuidFilter;
})(MvcGridFilter);

var MvcGridBooleanFilter = (function (base) {
    MvcGridExtends(MvcGridBooleanFilter, base);

    function MvcGridBooleanFilter(column) {
        base.call(this, column);

        this.methods = ['equals', 'not-equals'];
    }

    return MvcGridBooleanFilter;
})(MvcGridFilter);
