fetch('http://localhost:3000/api/users', {
  method: "POST",
  body: JSON.stringify({
    login: '123srhsrhs',
    password: '123shsrh'
  }),
  headers: {
    'Content-Type': 'application/json'
  }
}).then((res) => {
  console.log(res.status)
  return res.json();
}).then((data) => console.log(data))
