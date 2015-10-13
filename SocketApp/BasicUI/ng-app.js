// create the module and name it htmlDemo
var ngApp = angular.module('ngApp', 
  ['ngRoute', 
   'ngApp.aboutView',
   'ngApp.homeView']);

// configure our routes
ngApp.config(function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/'});
});




