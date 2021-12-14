/* "Infinite Markov Chain"
*  Adapted from Jun Shern's Example: Markov Music, from the Algorithmic Music Tutorial
*  URL: https://junshern.github.io/algorithmic-music-tutorial/
*/

let cnv, font;
let synth, sloop;
let graph, graphSelected = false;
let dict;

// Music
var velocity = 0.2; // From 0-1
let botNote, topNote;
// Markov Chain
var latestNodeId;
// Playback SoundLoops
var playing = false;
var prevEventMillis = 0;
var timeQuantizationStep = 100; // Quantize to 10 milliseconds
var maxDuration = 2000;
var longestDurationSoFar = timeQuantizationStep;

// Colors
var DEFAULT_NODE_COLOR = [255, 255, 255];
var ACTIVE_NODE_COLOR = [205, 0, 100];

let CONNECTION_LENGTH = 10;

function setup() {
  cnv = createCanvas(windowWidth,windowHeight);
  cnv.mousePressed(cnvPressed);
  frameRate(60);
  angleMode(DEGREES);

  synth = new p5.PolySynth();
  sloop = new p5.SoundLoop(soundLoop, 0.4);

  prevEventMillis = millis();

  // Buttons
  playPauseButton = createButton("Play");
  playPauseButton.position(20, height-40);
  playPauseButton.id("playPauseButton");
  playPauseButton.mousePressed(togglePlayPause);

  numRadio = createSelect();
  numRadio.option('Please Select');
  numRadio.option('TETRAHEDRON');
  numRadio.option('PYRAMID');
  numRadio.option('CUBOID');
  numRadio.position(20, 40);
  numRadio.changed(selectEvent);

  // ADSR Sliders
  attackSlider = createSlider(0, 1, 0.5, 0.1);
  attackSlider.style('width', '100px');
  attackSlider.position(width-120, 60);
  attackSlider.input(sliderEvent);
  decaySlider = createSlider(0, 1, 0.5, 0.1);
  decaySlider.style('width', '100px');
  decaySlider.position(width-120, 80);
  decaySlider.input(sliderEvent);
  sustainSlider = createSlider(0, 1, 0.5, 0.1);
  sustainSlider.style('width', '100px');
  sustainSlider.position(width-120, 100);
  sustainSlider.input(sliderEvent);
  releaseSlider = createSlider(0, 1, 0.5, 0.1);
  releaseSlider.style('width', '100px');
  releaseSlider.position(width-120, 120);
  releaseSlider.input(sliderEvent);
}

function draw() {
  translate(width/2,height/2);
  background(0);
  fill(50);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text('ADSR', width/2-70, -height/2+50);

  if (graphSelected) {
    graph.drawEdges();
    graph.labelNodes();
    //Draw visuals here
    for (let i = 0; i < graph.nodes.length; i++) {
      graph.nodes[i].update();
      graph.nodes[i].display();
    }

    fill(50);
    noStroke();
    textAlign(CENTER, CENTER);
    textStyle(NORMAL);
    // If there are no nodes, tell the users to play something
    if (graph.nodes.length == 0) {
      text("Error: No notes in lattice!", 0, height/2-30);
    }
    // If we are at the end of the chain, tell the users
    if (latestNodeId != null && graph.edges[latestNodeId].length == 0) {
      text("Error: No edges!", 0, height/2-30);
      sloop.stop();
      synth.noteRelease(); // Release all notes
    }
  }

  if (sloop.isPlaying) {
    text("Generating from lattice...", 0, height/2-30);
  } else {
    text("PAUSED", 0, height/2-30);
  }

  if (getAudioContext().state !== 'running') {
    fill(255,0,0);
    textStyle(BOLD);
    text("Error: Click canvas to allow Audio!", -width/2+120, -height/2+20);
  }
}

function cnvPressed() {
  if (getAudioContext().state !== 'running') {
    userStartAudio();
  }
}

function togglePlayPause() {
  var elem = document.getElementById("playPauseButton");
  if (sloop.isPlaying) {
    sloop.pause();
    synth.noteRelease();
    elem.innerHTML = "Play";
  } else {
    sloop.start();
    elem.innerHTML = "Pause";
  }
}

function soundStop() {
  if (sloop.isPlaying) {
    sloop.stop();
    synth.noteRelease();
  }
}

function soundLoop(cycleStartTime) {
  //Make a new, random ACTIVE COLOR
  var r = random(255);
  var g = random(255);
  var b = random(255);
  ACTIVE_NODE_COLOR = [r, g, b];

  // Transition to a random new node
  if (graph.edges[latestNodeId].length) {
    graph.nodes[latestNodeId].type = 0;
    latestNodeId = random(graph.edges[latestNodeId]);
    graph.nodes[latestNodeId].type = 1;
  }
  // Play the sound of this node
  var timeSincePrevEvent = graph.nodes[latestNodeId].timeSincePrevEvent / 1000; // Millis to seconds
  var midiNoteNumber = graph.nodes[latestNodeId].pitch;
  var freq = midiToFreq(midiNoteNumber);
  var type = graph.nodes[latestNodeId].type;
  if (type == 1) {
    synth.play(freq, velocity, cycleStartTime, timeSincePrevEvent);
  } else {
    synth.noteRelease(freq, cycleStartTime);
  }
  // Wait for the timeFromPrevEvent of the new node
  this.interval = max(timeSincePrevEvent, 0.01); // Cannot have interval of exactly 0
}

function selectEvent() {
  numRadio.disable('Please Select');

  if (numRadio.value() == 'CUBOID') {
    dict = CUBOID;
  } else if (numRadio.value() == 'PYRAMID') {
    dict = PYRAMID;
  } else {
    dict = TETRAHEDRON;
  }
  createGraph();
}

function sliderEvent() {
  synth.setADSR(attackSlider.value(), decaySlider.value(), sustainSlider.value(), releaseSlider.value());
}


function createGraph() {
  graphSelected = true;
  graph = new Graph();
  for (let i = 0; i < dict.vertices; i++) {
    // This is why the timing is so random
    let rando = Math.floor(random(300,1000));
    graph.registerNewNode(0, dict.midis[i], rando);
  }

  botNote = Math.min(...dict.midis);
  //console.log(botNote);
  topNote = Math.max(...dict.midis);
  //console.log(topNote);

  console.log(graph);
}

class Node {
  constructor(id, type, pitch, timeSincePrevEvent) {
    this.id = id;
    this.type = type; // 1 (note on) or 0 (note off)
    this.pitch = pitch;
    this.timeSincePrevEvent = timeSincePrevEvent;
    this.oscillateCounter = 0;
    var x = 0;
    var y = random(height/2-100, -height/2+100);
    this.center = createVector(x, y);
    this.position = createVector(x, y);
    this.color = DEFAULT_NODE_COLOR;
    this.diameter = 10;
    }
  display() {
    noStroke();
    var color;
    this.center.x = map(this.pitch, 60, 72, -width/2+100, width/2-100);
    // COLORS
    if (this.id == latestNodeId) {
      // Highlight latest node
      this.color = ACTIVE_NODE_COLOR;
    } else {
      this.color = DEFAULT_NODE_COLOR;
    }

    // Fill circle if note-on, stroke circle if note-off - they are always one for this!
    if (this.type == 1) {
      noStroke();
      fill(this.color[0], this.color[1], this.color[2]);
    } else {
      noFill();
      strokeWeight(2);
      stroke(this.color[0], this.color[1], this.color[2]);
    }
    ellipse(this.position.x, this.position.y, this.diameter, this.diameter);
  }
  update() {
    var xAmplitude = 1;
    var yAmplitude = 1;
    this.position.x = this.center.x + (xAmplitude * cos(this.oscillateCounter));
    this.position.y = this.center.y + (yAmplitude * sin(this.oscillateCounter));
    this.oscillateCounter = this.oscillateCounter + 6;
    // Movement
    var y = random(height/2-100, -height/2+100);
    let newVector = createVector(this.center.x, y);
    this.center.lerp(newVector, 0.001)
  }
  isSimilar(node) {
    if (this.type === node.type && this.pitch === node.pitch && this.duration === node.duration) {
      return true;
    } else {
      return false;
    }
  }
}

class Graph {
  constructor() {
    this.nodes = [];
    this.nodeIds = [];
    this.edges = [];
    this.numberOfEdges = 0;
  }
  findNode(node) {
    for (var i=0; i<this.nodes.length; i++) {
      if (node.isSimilar(this.nodes[i])) {
        return i;
      }
    }
    return -1; // Not found
  }
  registerNewNode(type, midiNoteNumber, timeSincePrevEvent) {
    var node = new Node(0, type, midiNoteNumber, timeSincePrevEvent);
    var nodeId = graph.findNode(node);
    if (nodeId == -1) { // If necessary, create the node
      nodeId = this.nodes.length;
      this.addNode(node);
    }
    node.id = nodeId;
    console.log(nodeId);
    if (latestNodeId != null) { // On initialization it will be null
      for (let i = nodeId-1; i > -1; i--) {
      // Add an edge from the other node to this one
      this.addEdge(i, nodeId);
      // AND ONE BACK from this node to the other, makes it a loop
      this.addEdge(nodeId, i);
    }
  }
    // Update the latest node ID
    latestNodeId = nodeId;
  }
  addNode(node) {
    var nodeId = this.nodes.length;
    this.nodeIds.push(nodeId);
    this.nodes.push(node);
    this.edges[nodeId] = [];
  }
  addEdge(nodeId1,nodeId2) {
    this.edges[nodeId1].push(nodeId2);
    this.numberOfEdges++;
  }
  drawEdges() {
    // Draw all edges leading away from this node
    strokeWeight(1);
    stroke(DEFAULT_NODE_COLOR);
    for (var i=0; i<graph.edges.length; i++) {
      var startNode = i;

      if (startNode == latestNodeId) { // Highlight the latest node's edges
        stroke(ACTIVE_NODE_COLOR);
      } else {
        //stroke(DEFAULT_NODE_COLOR);
        noStroke();
      }

      for (var j=0; j<graph.edges[i].length; j++) {
        var endNode = graph.edges[i][j];
        line(graph.nodes[startNode].position.x, graph.nodes[startNode].position.y, graph.nodes[endNode].position.x, graph.nodes[endNode].position.y);
      }
    }
  }
  labelNodes() {
    noStroke();
    fill(50);
    textStyle(BOLD);
    for (var i = 0; i < this.nodes.length; i++) {
      text(midiToNote[this.nodes[i].pitch],this.nodes[i].center.x + 15, this.nodes[i].center.y + 15);
    }
  }
}
