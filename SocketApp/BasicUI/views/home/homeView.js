var homeView = angular.module('ngApp.homeView', ['ngRoute']);
var socket = io.connect('http://localhost:3000');
homeView.config(['$routeProvider', function($routeProvider) {
  $routeProvider
  	//route to home
    .when('/', {
      templateUrl : 'views/home/homeView.html',
      controller  : 'homeViewController'
    });
}]);


homeView.controller('homeViewController', function($scope) {
  // create a message to display in our view
  $scope.message = 'This is the Home Page!';
});