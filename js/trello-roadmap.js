var syntax = /start: (.*)/;
var $auth;


$(function() {



	var updateLoggedIn = function() {
		var isLoggedIn = Trello.authorized();
		$("#loggedout").toggle(!isLoggedIn);
		$("#loggedin").toggle(isLoggedIn);
	};

	var logout = function() {
		Trello.deauthorize();
		updateLoggedIn();
	};



	$("#connectLink")
		.click(function() {
			$auth = $("<div>")
				.text("Authorisieren...")
				.appendTo("#output");
			Trello.authorize({
				type: "popup",
				success: onAuthorize
			})
		});

	$("#disconnect").click(logout);
});



function Roadmap(cards, member) {
	/* put cards in roadmap format */
	var data = {};
	data.lanes = new Array();
	data.items = new Array();

	data.lanes.push({
		id: 1,
		label: member.fullName
	})

	$.each(cards, function(ix, card) {

		if (card.due) {
			card.end = new Date(card.due);

			var ds = syntax.exec(card.desc);
			if (ds) {
				card.start = Date.parse(ds[1]);
			} else {
				card.start = new Date(card.end).add(-1).days();
			}

			data.items.push({
				id: ix,
				lane: 1,
				title: card.name,
				start: card.start,
				end: card.end,
				url: card.url + " ",
				desc: card.desc,
				class: "past"
			});
		}
	});
	//data2roadmap(data);
}

function getDataFromTrello(callback) {
	console.log("requesting authorization")

    var onAuthorize = function() {
		console.log("Trello authorized")

		$scope.status.text('loading trello data...')

		Trello.members.get("me", function(me) {

			$scope.member = me;
			$scope.status.text("Calendar for " + $scope.member.fullName);

			Trello.get("members/me/cards", callback);
		});

	};


	Trello.authorize({
		interactive: false,
		success: onAuthorize
	});

	return getDummyData();
}


function drawRoadmap(lanes, items, timeBegin, timeEnd) {
	laneLength = lanes.length

	if (timeBegin == null) timeBegin = 0;
	if (timeEnd == null) timeEnd = 2000;

	var m = [20, 15, 15, 120], //top right bottom left
		w = 960 - m[1] - m[3],
		h = 500 - m[0] - m[2],
		miniHeight = laneLength * 12 + 50,
		mainHeight = h - miniHeight - 50;

	//scales
	var x = d3.scale.linear()
		.domain([timeBegin, timeEnd])
		.range([0, w]);
	var x1 = d3.scale.linear()
		.range([0, w]);
	var y1 = d3.scale.linear()
		.domain([0, laneLength])
		.range([0, mainHeight]);
	var y2 = d3.scale.linear()
		.domain([0, laneLength])
		.range([0, miniHeight]);

	var chart = d3.select("#roadmap")
		.append("svg")
		.attr("width", w + m[1] + m[3])
		.attr("height", h + m[0] + m[2])
		.attr("class", "chart");

	chart.append("defs").append("clipPath")
		.attr("id", "clip")
		.append("rect")
		.attr("width", w)
		.attr("height", mainHeight);

	var main = chart.append("g")
		.attr("transform", "translate(" + m[3] + "," + m[0] + ")")
		.attr("width", w)
		.attr("height", mainHeight)
		.attr("class", "main");

	var mini = chart.append("g")
		.attr("transform", "translate(" + m[3] + "," + (mainHeight + m[0]) + ")")
		.attr("width", w)
		.attr("height", miniHeight)
		.attr("class", "mini");

	//main lanes and texts
	main.append("g").selectAll(".laneLines")
		.data(items)
		.enter().append("line")
		.attr("x1", m[1])
		.attr("y1", function(d) {
			return y1(d.lane);
		})
		.attr("x2", w)
		.attr("y2", function(d) {
			return y1(d.lane);
		})
		.attr("stroke", "lightgray")

	main.append("g").selectAll(".laneText")
		.data(lanes)
		.enter().append("text")
		.text(function(d) {
			return d;
		})
		.attr("x", -m[1])
		.attr("y", function(d, i) {
			return y1(i + .5);
		})
		.attr("dy", ".5ex")
		.attr("text-anchor", "end")
		.attr("class", "laneText");

	//mini lanes and texts
	mini.append("g").selectAll(".laneLines")
		.data(items)
		.enter().append("line")
		.attr("x1", m[1])
		.attr("y1", function(d) {
			return y2(d.lane);
		})
		.attr("x2", w)
		.attr("y2", function(d) {
			return y2(d.lane);
		})
		.attr("stroke", "lightgray");

	mini.append("g").selectAll(".laneText")
		.data(lanes)
		.enter().append("text")
		.text(function(d) {
			return d;
		})
		.attr("x", -m[1])
		.attr("y", function(d, i) {
			return y2(i + .5);
		})
		.attr("dy", ".5ex")
		.attr("text-anchor", "end")
		.attr("class", "laneText");

	var itemRects = main.append("g")
		.attr("clip-path", "url(#clip)");

	//mini item rects
	mini.append("g").selectAll("miniItems")
		.data(items)
		.enter().append("rect")
		.attr("class", function(d) {
			return "miniItem" + d.lane;
		})
		.attr("x", function(d) {
			return x(d.start);
		})
		.attr("y", function(d) {
			return y2(d.lane + .5) - 5;
		})
		.attr("width", function(d) {
			return x(d.end - d.start);
		})
		.attr("height", 10);

	//mini labels
	mini.append("g").selectAll(".miniLabels")
		.data(items)
		.enter().append("text")
		.text(function(d) {
			return d.id;
		})
		.attr("x", function(d) {
			return x(d.start);
		})
		.attr("y", function(d) {
			return y2(d.lane + .5);
		})
		.attr("dy", ".5ex");

	//brush
	var brush = d3.svg.brush()
		.x(x)
		.on("brush", display);

	mini.append("g")
		.attr("class", "x brush")
		.call(brush)
		.selectAll("rect")
		.attr("y", 1)
		.attr("height", miniHeight - 1);

	display();

	function display() {
		var rects, labels,
			minExtent = brush.extent()[0],
			maxExtent = brush.extent()[1],
			visItems = items.filter(function(d) {
				return d.start < maxExtent && d.end > minExtent;
			});

		mini.select(".brush")
			.call(brush.extent([minExtent, maxExtent]));

		x1.domain([minExtent, maxExtent]);

		//update main item rects
		rects = itemRects.selectAll("rect")
			.data(visItems, function(d) {
				return d.id;
			})
			.attr("x", function(d) {
				return x1(d.start);
			})
			.attr("width", function(d) {
				return x1(d.end) - x1(d.start);
			});

		rects.enter().append("rect")
			.attr("class", function(d) {
				return "miniItem" + d.lane;
			})
			.attr("x", function(d) {
				return x1(d.start);
			})
			.attr("y", function(d) {
				return y1(d.lane) + 10;
			})
			.attr("width", function(d) {
				return x1(d.end) - x1(d.start);
			})
			.attr("height", function(d) {
				return .8 * y1(1);
			});

		rects.exit().remove();

		//update the item labels
		labels = itemRects.selectAll("text")
			.data(visItems, function(d) {
				return d.id;
			})
			.attr("x", function(d) {
				return x1(Math.max(d.start, minExtent) + 2);
			});

		labels.enter().append("text")
			.text(function(d) {
				return d.id;
			})
			.attr("x", function(d) {
				return x1(Math.max(d.start, minExtent));
			})
			.attr("y", function(d) {
				return y1(d.lane + .5);
			})
			.attr("text-anchor", "start");

		labels.exit().remove();

	}
}

function updateCardView(card) {
	var converter = new Markdown.Converter();
	$scope.cardview.html(converter.makeHtml(card.desc));
	console.log(card.idMembers)
}

function drawRoadmapFromTrelloCards(cards, timeBegin, timeEnd) {
	var flatCards = [];
	var lanes = [];

	cards = cards.filter(function(card) {
		return card.due;
	}) // only use cards that have a due date

	// divide cards with multiple members such that
	// each card only has one member
	for(c in cards) {
		card = cards[c];
		members = card.idMembers;
		for(m in members) {
			member = members[m];

			card.idMembers = new Array(member);
			memberIndexInLane = lanes.indexOf(member);

			if(memberIndexInLane<0) {
				lanes.push(member);
				card.memberIndexInLane = lanes.length-1;
			} else {
				card.memberIndexInLane = memberIndexInLane;
			}

			console.log(card.name, card.memberIndexInLane)
			flatCards.push(card);
		}
	}

	cards = flatCards;

	console.log(cards.length);
	laneLength = lanes.length

	if (timeBegin == null) 
		timeBegin = d3.min(cards, function(d) { return new Date(d.due); });
	if (timeEnd == null) 
		timeEnd = d3.max(cards, function(d) { return new Date(d.due); });


	var m = [20, 15, 15, 120], //top right bottom left
		w = 960 - m[1] - m[3],
		h = 500 - m[0] - m[2],
		miniHeight = laneLength * 12 + 50,
		mainHeight = h - miniHeight - 50;


	var memberInLanes = function(card) {
			return card.memberIndexInLane;
		}

	var start = function(card) {
		return new Date(card.due).add(-10).days();
	}

	var end = function(card) {
		return new Date(card.due)
	}

	//scales
	var x = d3.time.scale()
		.domain([timeBegin, timeEnd])
		.range([10, w]);
	var x1 = d3.scale.linear()
		.range([0, w]);
	var y1 = d3.scale.linear()
		.domain([0, laneLength])
		.range([0, mainHeight]);
	var y2 = d3.scale.linear()
		.domain([0, laneLength])
		.range([0, miniHeight]);

	var chart = d3.select("#roadmap")
		.append("svg")
		.attr("width", w + m[1] + m[3])
		.attr("height", h + m[0] + m[2])
		.attr("class", "chart");

	chart.append("defs").append("clipPath")
		.attr("id", "clip")
		.append("rect")
		.attr("width", w)
		.attr("height", mainHeight);

	var main = chart.append("g")
		.attr("transform", "translate(" + m[3] + "," + m[0] + ")")
		.attr("width", w)
		.attr("height", mainHeight)
		.attr("class", "main");

	var mini = chart.append("g")
		.attr("transform", "translate(" + m[3] + "," + (mainHeight + m[0]) + ")")
		.attr("width", w)
		.attr("height", miniHeight)
		.attr("class", "mini");

	//main lanes and texts
	main.append("g").selectAll(".laneLines")
		.data(cards)
		.enter().append("line")
		.attr("x1", m[1])
		.attr("y1", function(d) {
			return y1(memberInLanes(d));
		})
		.attr("x2", w)
		.attr("y2", function(d) {
			return y1(memberInLanes(d));
		})
		.attr("stroke", "lightgray")

	main.append("g").selectAll(".laneText")
		.data(lanes)
		.enter().append("text")
		.text(function(d) {
			return d;
		})
		.attr("x", -m[1])
		.attr("y", function(d, i) {
			return y1(i + .5);
		})
		.attr("dy", ".5ex")
		.attr("text-anchor", "end")
		.attr("class", "laneText");

	//mini lanes and texts
	mini.append("g").selectAll(".laneLines")
		.data(cards)
		.enter().append("line")
		.attr("x1", m[1])
		.attr("y1", function(d) {
			return y2(memberInLanes(d));
		})
		.attr("x2", w)
		.attr("y2", function(d) {
			return y2(memberInLanes(d));
		})
		.attr("stroke", "lightgray");

	mini.append("g").selectAll(".laneText")
		.data(lanes)
		.enter().append("text")
		.text(function(d) {
			return d;
		})
		.attr("x", -m[1])
		.attr("y", function(d, i) {
			return y2(i + .5);
		})
		.attr("dy", ".5ex")
		.attr("text-anchor", "end")
		.attr("class", "laneText");

	var itemRects = main.append("g")
		.attr("clip-path", "url(#clip)");

	//mini item rects
	mini.append("g").selectAll("miniItems")
		.data(cards)
		.enter().append("rect")
		.attr("class", function(d) {
			return "miniItem" + memberInLanes(d);
		})
		.attr("x", function(d) {
			return x(start(d));
		})
		.attr("y", function(d) {
			return y2(memberInLanes(d) + .5) - 5;
		})
		.attr("width", function(d) {
			var diff = x(end(d)) - x(start(d));
			return diff;
		})
		.attr("height", 10);

	//mini labels
	/*mini.append("g").selectAll(".miniLabels")
		.data(cards)
		.enter().append("text")
		.text(function(d) {
			return d.name;
		})
		.attr("x", function(d) {
			return x(start(d));
		})
		.attr("y", function(d) {
			return y2(memberInLanes(d) + .5);
		})
		.attr("dy", ".5ex");
	*/
	//brush
	var brush = d3.svg.brush()
		.x(x)
		.on("brush", display);

	mini.append("g")
		.attr("class", "x brush")
		.call(brush)
		.selectAll("rect")
		.attr("y", 1)
		.attr("height", miniHeight - 1);

	//display();

	function display() {
		var rects, labels,
			minExtent = brush.extent()[0],
			maxExtent = brush.extent()[1],
			visItems = cards.filter(function(d) {
				return start(d) < maxExtent && end(d) > minExtent;
			});

		mini.select(".brush")
			.call(brush.extent([minExtent, maxExtent]));

		x1.domain([minExtent, maxExtent]);

		//update main item rects
		rects = itemRects.selectAll("rect")
			.data(visItems, function(d) {
				return d.id;
			})
			.attr("x", function(d) {
				return x1(start(d));
			})
			.attr("width", function(d) {
				return x1(end(d)) - x1(start(d));
			})
			.on("click", function(d) {
				itemRects.selectAll("rect").classed("active",false);
				d3.select(this).classed("active", true);
				updateCardView(d);
			});

		rects.enter().append("rect")
			.attr("class", function(d) {
				return "miniItem" + memberInLanes(d);
			})
			.attr("x", function(d) {
				return x1(start(d));
			})
			.attr("y", function(d) {
				return y1(memberInLanes(d)) + 10;
			})
			.attr("width", function(d) {
				return x1(end(d)) - x1(start(d));
			})
			.attr("height", function(d) {
				return .8 * y1(1);
			});

		rects.exit().remove();


		//update the item labels
		labels = itemRects.selectAll("text")
			.data(visItems, function(d) {
				return d.id;
			})
			.attr("x", function(d) {
				return x1(Math.max(start(d), minExtent) + 2);
			});

		labels.enter().append("text")
			.text(function(d) {
				return d.name;
			})
			.attr("x", function(d) {
				return x1(Math.max(start(d), minExtent));
			})
			.attr("y", function(d) {
				return y1(memberInLanes(d) + .5);
			});

		labels.exit().remove();

	}
}


function getDummyData() {
	var items = [{
		"lane": 0,
		"id": "Qin",
		"start": 5,
		"end": 205
	}, {
		"lane": 0,
		"id": "Jin",
		"start": 265,
		"end": 420
	}, {
		"lane": 0,
		"id": "Sui",
		"start": 580,
		"end": 615
	}, {
		"lane": 0,
		"id": "Tang",
		"start": 620,
		"end": 900
	}, {
		"lane": 0,
		"id": "Song",
		"start": 960,
		"end": 1265
	}, {
		"lane": 0,
		"id": "Yuan",
		"start": 1270,
		"end": 1365
	}, {
		"lane": 0,
		"id": "Ming",
		"start": 1370,
		"end": 1640
	}, {
		"lane": 0,
		"id": "Qing",
		"start": 1645,
		"end": 1910
	}, {
		"lane": 1,
		"id": "Yamato",
		"start": 300,
		"end": 530
	}, {
		"lane": 1,
		"id": "Asuka",
		"start": 550,
		"end": 700
	}, {
		"lane": 1,
		"id": "Nara",
		"start": 710,
		"end": 790
	}, {
		"lane": 1,
		"id": "Heian",
		"start": 800,
		"end": 1180
	}, {
		"lane": 1,
		"id": "Kamakura",
		"start": 1190,
		"end": 1330
	}, {
		"lane": 1,
		"id": "Muromachi",
		"start": 1340,
		"end": 1560
	}, {
		"lane": 1,
		"id": "Edo",
		"start": 1610,
		"end": 1860
	}, {
		"lane": 1,
		"id": "Meiji",
		"start": 1870,
		"end": 1900
	}, {
		"lane": 1,
		"id": "Taisho",
		"start": 1910,
		"end": 1920
	}, {
		"lane": 1,
		"id": "Showa",
		"start": 1925,
		"end": 1985
	}, {
		"lane": 1,
		"id": "Heisei",
		"start": 1990,
		"end": 1995
	}, {
		"lane": 2,
		"id": "Three Kingdoms",
		"start": 10,
		"end": 670
	}, {
		"lane": 2,
		"id": "North and South States",
		"start": 690,
		"end": 900
	}, {
		"lane": 2,
		"id": "Goryeo",
		"start": 920,
		"end": 1380
	}, {
		"lane": 2,
		"id": "Joseon",
		"start": 1390,
		"end": 1890
	}, {
		"lane": 2,
		"id": "Korean Empire",
		"start": 1900,
		"end": 1945
	}];
	var lanes = ["Chinese", "Japanese", "Korean"];
	return {
		items: items,
		lanes: lanes
	};
}