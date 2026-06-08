EXAMPLE STRUCTURE:


import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
    userRegisterService,
    userFindByNameService
} from "../models/usersModel.js";
import handleResponse from "../middlewares/responseHandler.js";


export const register = async(req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try 
    {
        await client.query("BEGIN");
        const newUser = await userRegisterService(client, username, hashedPassword);
        await client.query("COMMIT");
        handleResponse(res, 200, "已注册了新的账号！负责人会需要一下时间来启动您的账号，请耐心等待...", newUser);
    } catch(err)
    {
        await client.query("ROLLBACK");
        handleResponse(res, 400, "无法注册新账号: ", newUser);
    } finally {
        client.release();
    }
};

export const login = async(req, res) => {
    const { username, password } = req.body;
    const client = await pool.connect();
    try 
    {
        await client.query("BEGIN");
        const user = await userFindByNameService(client, username);
        if (!user) return handleResponse(res, 404, "用户不存在！");
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return handleResponse(res, 400, "密码错误！");
        if (user.valid === 0) return handleResponse(res, 400, "账号未被负责人启动！");

        const token = jwt.sign({id: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: "12h"});
        res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 60 * 60 * 1000 *12 });

        await client.query("COMMIT");
        handleResponse(res, 200, "账号登入成功！", { id: user.id, username: user.name, role: user.role });

    } catch(err)
    {
        await client.query("ROLLBACK");
        handleResponse(res, 400, `无法登入账号: ${err}`);
    }
    finally {
        client.release();
    }
};


export const logout = async(req, res) => {
    try 
    {
        res.clearCookie('token');
        handleResponse(res, 200, "已登出账号！")

    } catch(err)
    {
        handleResponse(res, 400, `无法登出账号: ${err}`);
    }
};