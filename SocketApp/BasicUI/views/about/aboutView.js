var aboutView = angular.module('ngApp.aboutView', ['ngRoute']);

aboutView.config(['$routeProvider', function($routeProvider) {
  $routeProvider
  	//route to about
    .when('/about', {
      templateUrl : 'views/about/aboutView.html',
      controller  : 'aboutViewController'
    });
}]);


aboutView.controller('aboutViewController', function($scope) {
  // create a message to display in our view
  $scope.message = 'This is the About Page!';
});