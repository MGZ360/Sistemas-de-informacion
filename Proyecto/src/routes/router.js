const express = require('express')
const router = express.Router()
const conexion = require('../database/db')
const authController = require('../controllers/authController')

//Rutas para las Vistas 'Views'
router.get('/',authController.isauthenticated,(req,res)=>{
    conexion.query('SELECT id, name, email FROM Users ORDER BY id', (error, Users)=>{
        if(error){
            console.error(error)
            return res.sendStatus(500)
        }
        res.render('index',{users: Users, updated:req.query.updated === '1'})
    })
})

router.post('/users/:id/name',authController.isauthenticated,(req,res)=>{
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const userId = Number(req.params.id)

    if(!Number.isInteger(userId) || userId < 1 || !name || name.length > 100){
        return res.redirect('/')
    }

    conexion.query('UPDATE Users SET name = ? WHERE id = ?',[name,userId],(error)=>{
        if(error){
            console.error(error)
            return res.sendStatus(500)
        }
        res.redirect('/?updated=1')
    })
})

router.get('/login',(req,res)=>{
    res.render('login',{alert:false})
})
router.get('/register',(req,res)=>{
    res.render('register')
})

router.get('/register2',authController.isauthenticated,(req,res)=>{
    res.render('register2',{email:req.email})
})

//Router para los metodos de controllers s
 router.post('/register', authController.register)
 router.post('/login', authController.login)
 router.get('/logout', authController.logout)

module.exports= router

