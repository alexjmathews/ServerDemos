module.exports = {
    'jwtSecret': 'ivnalcihqcbnqizn',
    'authDatabase': 'mongodb://localhost:27017',
    'port': 8080, 
    'tokenExpiration' : 1800, 
    'googleAuthURLBase' : "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=", 
    'mailerLocation' : "http://localhost:7070/api",
    'forgottenIDExpiration' : 60000
};