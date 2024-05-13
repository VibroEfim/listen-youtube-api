const express = require("express");
const ytConverter = require("yt-converter");
const youtubeSearchApi = require("youtube-search-api");
const bodyParser = require("body-parser");
const uuid = require("uuid");
const fs = require("fs");

const PORT = 9842;
const BARRIER = 60 * 15;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }))

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/search/:prompt", async (req, res) => {
  if (!req.params.prompt) {
    res.sendStatus(400);
    return;
  }

  const youtubeResult = await youtubeSearchApi.GetListByKeyword(req.params.prompt + " - topic", false, 10);

  const data = youtubeResult.items
    .filter(item => item.type == "video")
    .filter(item => !item.isLive)
    .filter(item => item.channelTitle)
    .filter(item => item.length ? getLengthByText(item.length.simpleText) < BARRIER : true)
    .filter(item => isTopic(item.channelTitle))
    .map(item => {
    return {
      url: formUrl(item.id),
      name: item.title,
      author: formAuthor(item.channelTitle),
      length: item.length ? getLengthByText(item.length.simpleText) : "no-data",
      size: 0,
    }
  })

  res.send(data.splice(0, Math.min(5, data.length)));
});

app.get("/data/", async (req, res) => {
  let id = req.query.id;

  if (!id) {
    res.sendStatus(400);
    return;
  }

  let link = formUrl(id);

  ytConverter.getInfo(link).then((info) => {
    console.log(info);
    res.send({
      name: info.title,
      author: formAuthor(info.author.name)
    })
  })
})

app.get("/download/", async (req, res) => {
  let id = req.query.id;

  if (!id) {
    res.sendStatus(400);
    return;
  }

  let link = formUrl(id);

  let name = uuid.v4();
  ytConverter.convertAudio({
    url: link,
    directoryDownload: "./download",
    title: name
  }, console.log, () => {
    res.sendFile(`${__dirname}/download/${name}.mp3`);
    console.log("Отправлено.")

    setTimeout(() => {
      fs.unlinkSync(`${__dirname}/download/${name}.mp3`);
      console.log("Удалено.")
    }, 1000 * 60 * 5);
  })
})

app.listen(PORT, () => {
  console.log("started");
})

function formUrl(id) {
  return "https://youtu.be/" + id;
}

function getLengthByText(text) {
  let args = text.split(":");

  let timings = [1, 60, 3600]

  let length = 0;

  let timing = 0;
  for (let i = args.length - 1; i >= 0; i--) {
    length += Number(args[i]) * timings[timing];
    timing++;
  }

  return length;
}

function formAuthor(author) {
  if (author.endsWith(" - Topic")) {
    return author.split(" - Topic")[0];
  }

  return author;
}

function isTopic(author) {
  return author.endsWith(" - Topic");
}