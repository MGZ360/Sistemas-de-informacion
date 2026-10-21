const express = require('express')
const router = express.Router()
const conexion = require('../database/db')
const authController = require('../controllers/authController')

const dashboardForRole = (role) => {
    if (role === 'admin') return '/admin'
    if (role === 'cajero') return '/cajero'
    if (role === 'cocina') return '/cocina'
    return '/login'
}

router.get('/', authController.isAuthenticated, (req, res) => {
    return res.redirect(dashboardForRole(req.user.role))
})

router.get('/admin', authController.isAuthenticated, authController.authorize(['admin']), (req, res) => {
    res.render('admin', { user: req.user })
})

router.get('/cajero', authController.isAuthenticated, authController.authorize(['cajero']), (req, res) => {
    res.render('cajero', { user: req.user })
})

router.get('/cocina', authController.isAuthenticated, authController.authorize(['cocina']), (req, res) => {
    res.render('cocina', { user: req.user })
})

router.get('/login', (req, res) => {
    const alert = req.query.expired === '1' || req.query.inactive === '1' || req.query.reset === '1' || req.query.registered === '1'
    const alertTitle = req.query.expired === '1' ? 'Sesión expirada' :
        req.query.inactive === '1' ? 'Cuenta inactiva' :
        req.query.reset === '1' ? 'Contraseña actualizada' :
        req.query.registered === '1' ? 'Registro exitoso' : 'Información'

    const alertMessage = req.query.expired === '1' ? 'Su sesión caducó por inactividad.' :
        req.query.inactive === '1' ? 'Su cuenta está inactiva.' :
        req.query.reset === '1' ? 'Ahora puede iniciar sesión con su nueva contraseña.' :
        req.query.registered === '1' ? 'Su usuario fue registrado correctamente.' : 'Bienvenido'

    return res.render('login', {
        alert,
        alertTitle,
        alertMessage,
        alertIcon: req.query.expired === '1' || req.query.inactive === '1' ? 'warning' : 'success',
        showConfirmButton: true,
        timer: false,
        ruta: 'login'
    })
})

router.get('/register', (req, res) => {
    res.render('register', { alert: false })
})

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { alert: false, resetToken: '' })
})

router.get('/reset-password', authController.renderResetPassword)

router.get('/register2', authController.isAuthenticated, (req, res) => {
    res.render('register2', { email: req.user.email })
})

router.get('/logout', authController.logout)

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)

module.exports = router
