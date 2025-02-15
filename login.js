document.addEventListener('DOMContentLoaded', function() {
  // Check if user is already logged in
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      // User is signed in, close this tab and return to extension
      window.close();
    }
  });

  const errorDiv = document.getElementById('error');

  document.getElementById('login').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        window.close();
      })
      .catch(error => {
        errorDiv.textContent = error.message;
      });
  });

  document.getElementById('signup').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(userCredential => {
        window.close();
      })
      .catch(error => {
        errorDiv.textContent = error.message;
      });
  });

  document.getElementById('google-signin').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .then(result => {
        window.close();
      })
      .catch(error => {
        errorDiv.textContent = error.message;
      });
  });
}); 