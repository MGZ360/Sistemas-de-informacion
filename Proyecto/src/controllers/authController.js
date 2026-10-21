const jwt = require('jsonwebtoken')
const bcryptjs = require('bcryptjs')
const crypto = require('crypto')
const conexion = require('../database/db')
const { promisify } = require('util')

const JWT_TIMEOUT_MINUTES = Number(process.env.JWT_TIMEOUT_MINUTES || 15)
const SESSION_TIMEOUT_MINUTES = Number(process.env.SESSION_TIMEOUT_MINUTES || 15)

const renderAuthView = (res, view, data = {}) => {
    return res.render(view, {
        alert: false,
        alertTitle: '',
        alertMessage: '',
        alertIcon: 'info',
        showConfirmButton: false,
        timer: false,
        ruta: '',
        ...data
    })
}

const getRoleRedirect = (role) => {
    if (role === 'admin') return '/admin'
    if (role === 'cajero') return '/cajero'
    if (role === 'cocina') return '/cocina'
    return '/login'
}

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRETO,
        { expiresIn: `${JWT_TIMEOUT_MINUTES}m` }
    )
}

const setAuthCookie = (res, token) => {
    res.cookie('jwt', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: JWT_TIMEOUT_MINUTES * 60 * 1000,
        secure: false
    })
}

const updateLastActivity = (userId) => {
    return new Promise((resolve, reject) => {
        conexion.query('UPDATE users SET last_activity = NOW() WHERE id = ?', [userId], (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}

const isSessionExpired = (user) => {
    if (!user.last_activity) return false
    const lastActivity = new Date(user.last_activity)
    const differenceMinutes = (Date.now() - lastActivity.getTime()) / (60 * 1000)
    return differenceMinutes > SESSION_TIMEOUT_MINUTES
}

exports.register = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim()
        const email = String(req.body.email || '').trim().toLowerCase()
        const password = String(req.body.password || '')
        const role = String(req.body.role || 'cajero')

        if (!name || !email || !password) {
            return renderAuthView(res, 'register', {
                alert: true,
                alertTitle: 'Advertencia',
                alertMessage: 'Nombre, correo y contraseña son obligatorios.',
                alertIcon: 'info',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            })
        }

        if (!['admin', 'cajero', 'cocina'].includes(role)) {
            return renderAuthView(res, 'register', {
                alert: true,
                alertTitle: 'Rol inválido',
                alertMessage: 'El rol seleccionado no es válido.',
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            })
        }

        if (password.length < 6) {
            return renderAuthView(res, 'register', {
                alert: true,
                alertTitle: 'Contraseña débil',
                alertMessage: 'La contraseña debe tener al menos 6 caracteres.',
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            })
        }

        const passHash = await bcryptjs.hash(password, 8)

        conexion.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email], async (error, results) => {
            if (error) throw error

            if (results.length > 0) {
                return renderAuthView(res, 'register', {
                    alert: true,
                    alertTitle: 'Correo ya registrado',
                    alertMessage: 'Ya existe un usuario con ese correo.',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'register'
                })
            }

            conexion.query(
                'INSERT INTO users (name, email, password, role, status, last_activity) VALUES (?, ?, ?, ?, ?, NOW())',
                [name, email, passHash, role, 'active'],
                (insertError) => {
                    if (insertError) {
                        console.log(insertError)
                        return renderAuthView(res, 'register', {
                            alert: true,
                            alertTitle: 'Error',
                            alertMessage: 'No se pudo registrar el usuario.',
                            alertIcon: 'error',
                            showConfirmButton: true,
                            timer: false,
                            ruta: 'register'
                        })
                    }

                    return res.redirect('/login?registered=1')
                }
            )
        })
    } catch (error) {
        console.log(error)
        return res.redirect('/login')
    }
}

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase()
        const password = String(req.body.password || '')

        if (!email || !password) {
            return renderAuthView(res, 'login', {
                alert: true,
                alertTitle: 'Advertencia',
                alertMessage: 'Ingrese su correo y contraseña.',
                alertIcon: 'info',
                showConfirmButton: true,
                timer: false,
                ruta: 'login'
            })
        }

        conexion.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email], async (error, results) => {
            if (error) {
                console.log(error)
                return renderAuthView(res, 'login', {
                    alert: true,
                    alertTitle: 'Error',
                    alertMessage: 'No se pudo validar el usuario.',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login'
                })
            }

            const user = results[0]
            if (!user || !(await bcryptjs.compare(password, user.password))) {
                return renderAuthView(res, 'login', {
                    alert: true,
                    alertTitle: 'Error',
                    alertMessage: 'Usuario y/o contraseña incorrectos.',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login'
                })
            }

            if (user.status !== 'active') {
                return renderAuthView(res, 'login', {
                    alert: true,
                    alertTitle: 'Cuenta inactiva',
                    alertMessage: 'Su cuenta está inactiva. Contacte al administrador.',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login'
                })
            }

            const token = generateToken(user)
            setAuthCookie(res, token)

            try {
                await updateLastActivity(user.id)
            } catch (updateError) {
                console.log(updateError)
            }

            return res.redirect(getRoleRedirect(user.role))
        })
    } catch (error) {
        console.log(error)
        return renderAuthView(res, 'login', {
            alert: true,
            alertTitle: 'Error',
            alertMessage: 'Ocurrió un error inesperado.',
            alertIcon: 'error',
            showConfirmButton: true,
            timer: false,
            ruta: 'login'
        })
    }
}

exports.isAuthenticated = async (req, res, next) => {
    const token = req.cookies.jwt

    if (!token) {
        return res.redirect('/login')
    }

    try {
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRETO)

        conexion.query('SELECT * FROM users WHERE id = ? LIMIT 1', [decoded.id], async (error, results) => {
            if (error) {
                console.log(error)
                return res.redirect('/login')
            }

            const user = results[0]
            if (!user) {
                res.clearCookie('jwt')
                return res.redirect('/login')
            }

            if (user.status !== 'active') {
                res.clearCookie('jwt')
                return res.redirect('/login?inactive=1')
            }

            if (isSessionExpired(user)) {
                res.clearCookie('jwt')
                return res.redirect('/login?expired=1')
            }

            req.user = user
            try {
                await updateLastActivity(user.id)
            } catch (updateError) {
                console.log(updateError)
            }
            return next()
        })
    } catch (error) {
        console.log(error)
        res.clearCookie('jwt')
        return res.redirect('/login?expired=1')
    }
}

exports.authorize = (roles) => (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login')
    }

    if (!roles.includes(req.user.role)) {
        return res.status(403).render('forbidden', {
            user: req.user,
            message: 'No tienes permisos para acceder a esta sección.'
        })
    }

    return next()
}

exports.logout = (req, res) => {
    res.clearCookie('jwt')
    return res.redirect('/login')
}

exports.forgotPassword = (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase()

    if (!email) {
        return renderAuthView(res, 'forgot-password', {
            alert: true,
            alertTitle: 'Advertencia',
            alertMessage: 'Ingresa tu correo para recuperar la contraseña.',
            alertIcon: 'info',
            showConfirmButton: true,
            timer: false,
            ruta: 'forgot-password'
        })
    }

    conexion.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email], (error, results) => {
        if (error) {
            console.log(error)
            return renderAuthView(res, 'forgot-password', {
                alert: true,
                alertTitle: 'Error',
                alertMessage: 'No se pudo procesar la solicitud.',
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'forgot-password'
            })
        }

        if (!results[0]) {
            return renderAuthView(res, 'forgot-password', {
                alert: true,
                alertTitle: 'Correo no encontrado',
                alertMessage: 'Si el correo existe en el sistema, se generará un código de recuperación.',
                alertIcon: 'info',
                showConfirmButton: true,
                timer: false,
                ruta: 'forgot-password'
            })
        }

        const resetToken = crypto.randomBytes(20).toString('hex')
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

        conexion.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [resetToken, resetTokenExpiry, results[0].id],
            (updateError) => {
                if (updateError) {
                    console.log(updateError)
                    return renderAuthView(res, 'forgot-password', {
                        alert: true,
                        alertTitle: 'Error',
                        alertMessage: 'No se pudo generar el código de recuperación.',
                        alertIcon: 'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'forgot-password'
                    })
                }

                return res.render('forgot-password', {
                    alert: true,
                    alertTitle: 'Código temporal generado',
                    alertMessage: 'Usa el siguiente código para restablecer tu contraseña.',
                    alertIcon: 'success',
                    showConfirmButton: false,
                    timer: false,
                    ruta: 'reset-password?token=' + resetToken,
                    resetToken
                })
            }
        )
    })
}

exports.renderResetPassword = (req, res) => {
    const token = String(req.query.token || '')

    if (!token) {
        return res.redirect('/forgot-password')
    }

    return res.render('reset-password', {
        token,
        alert: false
    })
}

exports.resetPassword = (req, res) => {
    const token = String(req.body.token || '')
    const password = String(req.body.password || '')

    if (!token || !password) {
        return res.render('reset-password', {
            token,
            alert: true,
            alertTitle: 'Advertencia',
            alertMessage: 'El código y la nueva contraseña son obligatorios.',
            alertIcon: 'info',
            showConfirmButton: true,
            timer: false,
            ruta: 'forgot-password'
        })
    }

    if (password.length < 6) {
        return res.render('reset-password', {
            token,
            alert: true,
            alertTitle: 'Contraseña débil',
            alertMessage: 'La contraseña debe tener al menos 6 caracteres.',
            alertIcon: 'error',
            showConfirmButton: true,
            timer: false,
            ruta: 'forgot-password'
        })
    }

    conexion.query(
        'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW() LIMIT 1',
        [token],
        async (error, results) => {
            if (error) {
                console.log(error)
                return res.redirect('/forgot-password')
            }

            const user = results[0]
            if (!user) {
                return res.render('reset-password', {
                    token,
                    alert: true,
                    alertTitle: 'Código inválido',
                    alertMessage: 'El código de recuperación no es válido o ya expiró.',
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'forgot-password'
                })
            }

            const passHash = await bcryptjs.hash(password, 8)

            conexion.query(
                'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
                [passHash, user.id],
                (updateError) => {
                    if (updateError) {
                        console.log(updateError)
                        return res.redirect('/forgot-password')
                    }

                    return res.redirect('/login?reset=1')
                }
            )
        }
    )
}

module.exports = {
    register: exports.register,
    login: exports.login,
    isAuthenticated: exports.isAuthenticated,
    authorize: exports.authorize,
    logout: exports.logout,
    forgotPassword: exports.forgotPassword,
    renderResetPassword: exports.renderResetPassword,
    resetPassword: exports.resetPassword
}
