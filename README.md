# if you need multi account

use proxy
```
{
  "accounts": [
    {
      "email": "youe_email@gmail.com",
      "password": "kata_sandi_akun_1",
      "proxy": {
        "host": "proxy_host_1",
        "port": 8080,
        "username": "user1",
        "password": "pass1"
      }
    },
    {
      "email": "your_email@gmail.com",
      "password": "kata_sandi_akun_2",
      "proxy": null
    }
  ]
}
```

non proxy
```
{
  "accounts": [
    {
      "email": "your@gmail.com",
      "password": "paswword" 
    },
    {
      "email": "your@gmail.com", 
      "password": "pasword" 
    },
    {
      "email": "", 
      "password": "" 
    }
  ]
}
```
