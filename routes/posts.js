const express = require('express')
const moment = require('moment')
const router = express.Router()
const path = require('path')

const checkLogin = require('../middlewares/check').checkLogin
const PostModel = require('../models/posts')
const UserModel = require('../models/users')
const fs = require('fs')
const { to, createSession, removeProperty } = require('../lib/util')

// 获取列表
router.get('/', async (req, res, next) => {
  try {
    let { limit = 10, page = 0, find } = req.query
    let err, data

    limit = parseInt(limit)
    page = parseInt(page)

    if (isNaN(limit) || isNaN(page)) {
      throw new Error('分页参数不正确')
    }

    // 带有查询条件
    if (find) {
      try {
        find = JSON.parse(find)
        let { type, userid, eit } = find
        if (type || userid || eit) {
          find = {
            type,
            userid,
            eit
          }
        }
        removeProperty(find)
      } catch (e) {
        res.retErr('搜索格式错误')
        return
      }
    } else {
      find = {}
    }
    console.log(find)
    ;[err, data] = await to(PostModel.getPosts(limit, page, find))
    if (err) throw new Error(err)

    for (let item of data) {
      delete item.openid
    }
    res.retData(data)
  } catch (e) {
    res.retErr(e.message)
    return
  }
})

// POST 发表一篇文章
router.post('/', checkLogin, async (req, res, next) => {
  try {
    let err, data
    let {
      content,
      images,
      task,
      eit,
      type = 'say',
      coordinates,
      posName,
      userid
    } = req.fields

    if (!content && images.length === 0) {
      throw new Error('你的想法呢？')
    }

    ;[err, data] = await to(UserModel.getUserById(userid))
    if (err) throw new Error(err)
    if (!data) throw new Error('没有此用户')

    let user = data
    let { nickName, avatarFile, city, gender, country, postAt } = user

    let diff = Date.now() - postAt
    if (diff <= 10000) {
      return res.retErr('歇一歇哦，发帖过快~')
    }

    let post = {
      userid,
      nickName,
      avatarFile,
      city,
      gender,
      country,
      type,
      content,
      images,
      task,
      eit,
      coordinates,
      posName,
      pv: 0,
      zan: 0,
      createTime: Date.now()
    }
    removeProperty(post)
    // 创建文章
    ;[err] = await to(PostModel.create(post))
    if (err) throw new Error(err)

    // 更新用户资料
    user = {
      postAt: Date.now()
    }
    ;[err] = await to(UserModel.updateByid(userid, user))
    if (err) throw new Error(err)

    return res.retData('发布成功！')
  } catch (e) {
    return res.retErr(e.message)
  }
})

// 文章点赞
router.post('/zan', async (req, res, next) => {
  try {
    const { postId, zan = true, userid } = req.fields
    let err, data

    PostModel.incZan(postId)
  } catch (e) {
    return res.retErr(e.message)
  }
})

// GET 获取文章详情
router.get('/:postId', async (req, res, next) => {
  const { postId } = req.params
  Promise.all([
    PostModel.getPostById(postId), // 获取文章信息
    PostModel.incPv(postId) // pv 加 1
  ])
    .then(post => {
      if (!post) {
        res.retErr('该文章不存在')
      }
      let data = post
      res.retData({
        data
      })
    })
    .catch(next)
})

// PUT 更新一篇文章
router.put('/:postId', checkLogin, (req, res, next) => {
  const {
    openid,
    content,
    images = [],
    coordinates = [],
    posName = '',
    eit = '',
    task = {}
  } = req.fields
  const postId = req.params.postId

  // 校验参数
  try {
    if (!content.length) {
      throw new Error('请填写内容')
    }
  } catch (e) {
    req.retErr(e.message)
    return
  }

  PostModel.getRawPostById(postId).then(post => {
    if (!post) {
      return res.retErr('文章不存在')
    }
    if (post.openid !== openid) {
      return res.retErr('你只能删除自己的文章')
    }

    PostModel.updatePostById(postId, {
      content,
      images,
      eit,
      task,
      coordinates,
      posName
    })
      .then(() => {
        return res.retData('success', '编辑成功')
      })
      .catch(next)
  })
})

// DELETE 删除文章
router.delete('/:postId', checkLogin, (req, res, next) => {
  const { openid } = req.fields
  const postId = req.params.postId

  PostModel.getRawPostById(postId).then(post => {
    if (!post) {
      return res.retErr('文章不存在')
    }
    if (post.openid !== openid) {
      return res.retErr('你只能删除自己的文章')
    }
    PostModel.delPostById(postId)
      .then(() => {
        return res.retData('success', '删除成功')
      })
      .catch(next)
  })
})

// 上传图片
// router.post('/upload', (req, res, next) => {
//   res.retData(req.files.file.path.split(path.sep).pop())
// })

module.exports = router
