const express = require('express')
const router = express.Router()

const { checkLogin, getUserinfo } = require('../middlewares/check')
const CommentModel = require('../models/comments')
const PostModel = require('../models/posts')
const UserModel = require('../models/users')

const { to, removeProperty } = require('../lib/util')

// POST /comments 创建一条留言
router.post('/', checkLogin, getUserinfo, async (req, res, next) => {
  try {
    let err, data
    const { content, userid, targid, type = 'post' } = req.fields
    const { nickName, avatarFile, postAt } = req.userinfo
    let vistid

    let diff = Date.now() - postAt
    if (diff <= 10000) {
      throw new Error('歇一歇哦，发帖过快~')
    }

    if (type === 'post') {
      ;[err, data] = await to(PostModel.getPostById(targid))
      if (err) throw new Error(err)
      if (!data) throw new Error('没有此文章')
      vistid = data.userid
    } else if (type === 'user') {
      vistid = targid
      if (userid === targid) throw new Error('不能给自己留言')
      ;[err, data] = await to(UserModel.getUserById(vistid))
      if (err) throw new Error(err)
      if (!data) throw new Error('没有此用户')
    }

    let comment = {
      userid,
      vistid,
      targid,
      type,
      content,
      nickName,
      avatarFile
    }
    removeProperty(comment)
    ;[err, data] = await to(CommentModel.create(comment))
    if (err) throw new Error(err)

    // 更新用户发帖时间
    user = {
      postAt: Date.now()
    }
    await UserModel.updateByid(userid, user)

    return res.retData('发表成功')
  } catch (e) {
    return res.retErr(e.message)
  }
})

module.exports = router