var ListGroupCtrl = [
		'$scope',
		'$attrs',
		'$parse',
		'$filter',
		'$sce',
		'$compile',
		'$timeout',
		function($scope, $attrs, $parse, $filter, $sce, $compile, $timeout) {

			var ctrl = this;

			var defaultBeforeSelectionChange = function(item) {
				return true;
			};

			ctrl.$$items = [];

			ctrl.$$selectedItems = $scope.selectedItems;
			if(!ctrl.$$selectedItems){
				ctrl.$$selectedItems = [];
			}
			
			ctrl.filter = {
				text : '',
				comparator : 'contains',
				ignoreCase : true,
				placeholder : '',
				auto : true
			};
			ctrl.beforeSelectionChange = (!$attrs.beforeSelectionChange) ? defaultBeforeSelectionChange
					: $scope.beforeSelectionChange;
			ctrl.afterSelectionChange = (!$attrs.afterSelectionChange) ? angular.noop
					: $scope.afterSelectionChange;
			ctrl.$selectItem = function(item) {
				var idx = -1;
				if ((idx = ctrl.isSelected(item)) > -1) {
					ctrl.$$selectedItems.splice(idx, 1);
				} else {
					if (!($attrs.selectable == 'multiple')) {
						ctrl.$$selectedItems.length = 0;
					}
					ctrl.$$selectedItems.push(item);
				}
			};

			if ($scope.datasource) {
				var fn = $scope.datasource;
				if (!angular.isFunction(fn)) {
					throw 'datasource attribute must be a function returning a promise';
				}
				fn().then(function(items) {
					render(items);
				});
			} else if ($scope.items) {
				render($scope.items);
			} else {
				throw 'no items supplied. Use items or datasource attribute';
			}

			function render(items) {
				angular.extend(ctrl.$$items, items);
				if ($attrs.filterable && angular.isObject($scope.filterable)) {
					angular.extend(ctrl.filter, $scope.filterable);
				}
			}

			ctrl.select = function(item) {
				if (!ctrl.isDisabled(item)) {
					var output = ctrl.beforeSelectionChange({
						item : item
					});
					if (angular.isUndefined(output)) {
						throw new Error(
								"'beforeSelectionChange' returned undefined as value! Check the binding or the returned value");
					}
					if (output) {
						if (angular.isFunction(output.then)) {
							output.then(function(returnedValue) {
								if (returnedValue === true) {
									ctrl.$selectItem(item);
									$timeout(function() {
										ctrl.afterSelectionChange({
											item : item
										})
									}, 50, true);
								}
							});
						} else if (output === true) {
							ctrl.$selectItem(item);
							$timeout(function() {
								ctrl.afterSelectionChange({
									item : item
								})
							}, 50, true);
						}
					}
				}
			}

			ctrl.isSelected = function(item) {
				var idx = -1;
				for (var i = 0, len = ctrl.$$selectedItems.length; i < len; i++) {
					if (item === ctrl.$$selectedItems[i]) {
						idx = i;
						break;
					}
				}
				return idx;
			};

			ctrl.resolveContextualClass = function(item) {
				var clazz = $scope.contextualClass;
				if ($attrs.contextualClass) {
					var fn = $parse($attrs.contextualClass);
					if (angular.isFunction(fn)) {
						var val = fn($scope.$parent, {
							item : item
						});
						if (val) {
							clazz = val;
						}
					}
				}
				return clazz;
			}

			/**
			 * Returns <code>true</code> if the specified item if disabled,
			 * <code>false</code> otherwise
			 */
			ctrl.isDisabled = function(item) {
				var disabled = false;
				if ($attrs.disabled) {
					if ($scope.disabled === true) {
						disabled = $scope.disabled;
					} else {
						var fn = $parse($attrs.disabled);
						if (angular.isFunction(fn)) {
							disabled = fn($scope.$parent, {
								item : item
							});
						}
					}
				}
				return disabled;
			};

			/**
			 * 
			 */
			ctrl.executeFilter = function() {
				ctrl.$$items = $filter('filter')($scope.items,
						ctrl.filter.text, ctrl.filter.comparator);
			};

			ctrl.clearFilter = function() {
				ctrl.filter.text = '';
				ctrl.$$items = $scope.items;
			}

			$scope.compare = function(actual, expected) {
				var match = true;
				if (ctrl.filter.auto === true) {
					match = $filter(ctrl.filter.comparator)(actual, expected,
							ctrl.filter.ignoreCase);
				}
				return match;
			};

			var removeSelectedItemsListener = $scope.$watchCollection(
					'ctrl.$$selectedItems', function(newValue, oldValue) {
						if ('selectedItems' in $attrs) {
							$scope.selectedItems = newValue;
						}
					});

			$scope.$on('$destroy', function() {
				removeSelectedItemsListener();
			});

		} ];

listGroupDirectives.directive('listGroup', [ '$templateCache',
		function($templateCache) {
			return {
				restrict : 'EA',
				replace : true,
				template : function(elem, attrs) {
					var templateName = 'list-group.tpl.html';
					if ('selectable' in attrs) {
						templateName = 'linked-list-group.tpl.html';
					}
					if ('filterable' in attrs || 'header' in attrs) {
						templateName = 'panel-list-group.tpl.html';
					}
					return $templateCache.get(templateName);
				},
				controller : ListGroupCtrl,
				controllerAs : 'ctrl',
				scope : {
					items : '=',
					labelFn : '@?',
					selectedItems : '=?',
					beforeSelectionChange : '&?',
					afterSelectionChange : '&?',
					disabled : '@?',
					contextualClass : '@?',
					filterable : '=?',
					selectable : '@?',
					template : '=?',
					templateUrl : '=?',
					header : '=?',
					datasource : '=?'
				}
			};
		} ]);

listGroupDirectives.directive('listGroupItemContent', [
		'$compile',
		'$templateRequest',
		function($compile, $templateRequest) {
			return {
				restrict : 'EA',
				replace : true,
				scope : true,
				controller : function($scope, $attrs, $parse) {
					var ctrl = this;
					ctrl.resolveLabel = function(item) {
						var label = item;
						if ($scope.labelFn) {
							var fn = $parse($scope.labelFn);
							// item ng-repeat scope
							var targetScope = $scope.$parent;
							// listGroup directive scope
							targetScope = targetScope.$parent;
							// Client Ctrl scope
							targetScope = targetScope.$parent;
							label = fn(targetScope, {
								item : item
							});

						} else if (item.label) {
							label = item.label;
						} else if (angular.isObject(item)) {
							label = angular.toJson(item);
						}
						return label;
					};
				},
				controllerAs : 'ctrl',
				compile : function(tElement, tAtrrs) {
					return function(scope, element, attrs, ctrl) {
						var html;
						if (scope.templateUrl) {
							$templateRequest(scope.templateUrl).then(
									function(html) {
										element.replaceWith($compile(html)(
												scope));
									});
						} else if (scope.template) {
							element
									.replaceWith($compile(scope.template)
											(scope));
						} else {
							element.replaceWith(ctrl.resolveLabel(scope.item));
						}
					}
				}
			}
		} ]);

listGroupDirectives.directive('listGroupHtml', function() {
	return {
		restrict : 'EA',
		replace : true,
		terminal : true,
		scope : false,
		templateUrl : 'list-group.tpl.html'
	}
});

listGroupDirectives.directive('linkedListGroupHtml', function() {
	return {
		restrict : 'EA',
		replace : true,
		terminal : true,
		scope : false,
		templateUrl : 'linked-list-group.tpl.html'
	}
});

listGroupDirectives.directive('listGroupFilter', function() {
	return {
		restrict : 'EA',
		replace : true,
		terminal : true,
		scope : false,
		templateUrl : 'list-group-filter.tpl.html'
	}
});

listGroupDirectives.directive('panelListGroupTitle', function() {
	return {
		restrict : 'EA',
		replace : true,
		terminal : true,
		scope : false,
		templateUrl : 'panel-list-group-title.tpl.html',
		compile : function(tElement, tAtrrs) {
			return function(scope, element, attrs, listGroupCtrl) {
				if (angular.isString(scope.header)) {
					scope.title = scope.header;
				}
			}
		}
	}
});
