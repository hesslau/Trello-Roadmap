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

	var chart = d3.select("body")
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


function drawRoadmapFromTrelloCards(cards, timeBegin, timeEnd) {
	var lanes = ["4f82f81397d499ab414d7e36"];
	// items 

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

	var chart = d3.select("body")
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

function getDummyTrelloCards() {

	return [{"id":"4f82f6df906b088d78bd8db2","badges":{"votes":1,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":4,"checkItemsChecked":0,"comments":0,"attachments":1,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-26T11:29:11.405Z","desc":"## Logo\n* Hand zeigt Häufchen Erde, aus dem ein Pflänzchen wächst (siehe Bild im Anhang)\n\n## Farben\n\nz.B. [Grün, Hellbraun, Dunkelbraun, Dunklesblaugrau](http://swatchlet.com/#BBC946,DBBE74,4B382B,162326)\n\n## Typeface\n\n* [Eco Font] (http://www.ecofont.com/en/products/green/font/ecofont-sans.html) - die \"Öko-Schriftart\" schlechthin. allerdings nicht sonderlich hübsch\n","descData":null,"due":null,"idBoard":"4f468facc76804126879a11d","idChecklists":["4f8e7e3a0a721a48624efa97"],"idList":"4f468facc76804126879a122","idMembers":["4f4d134dc57785d3726e5954","4f357259497d87255b0469e3","4f468e4822528aac66f02343","4f9707e43dbc508725311ede"],"idMembersVoted":["4f3fe2eba34a8c9221062864"],"idShort":12,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"yellow","name":"Kommunikation"}],"name":"Corporate Design","pos":65536,"shortLink":"ostRZqIO","shortUrl":"https://trello.com/c/ostRZqIO","subscribed":true,"url":"https://trello.com/c/ostRZqIO/12-corporate-design"},{"id":"4f82f71f906b088d78bd9408","badges":{"votes":1,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-26T12:21:04.582Z","desc":"Bilder von schlecht reparierten Pflanzen (z.B. Ast ist am Baum mit Paketklebeband und Gaffer Tape geklebt) mit Slogan wie z.B. \n\n* Kontrollieren statt reparieren\n* Vorsicht ist besser als Nachsicht\n* You can't fix a tree. Save it.\n* ...","descData":null,"due":null,"idBoard":"4f468facc76804126879a11d","idChecklists":[],"idList":"4f82f6f9906b088d78bd8fed","idMembers":["4f357259497d87255b0469e3","4f9707e43dbc508725311ede"],"idMembersVoted":["4fa192f8cfc897106d9e43b2"],"idShort":14,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"yellow","name":"Kommunikation"}],"name":"Kommunikation: Fix Naure","pos":65536,"shortLink":"UlYQsJVB","shortUrl":"https://trello.com/c/UlYQsJVB","subscribed":true,"url":"https://trello.com/c/UlYQsJVB/14-kommunikation-fix-naure"},{"id":"4f82f81397d499ab414d7e36","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-26T12:21:23.319Z","desc":"Mein Onkel ist Landwirt und hat eine Zeit lang Vorträge über die Biogas-Forschung bei VW, bei der er auch aktiv war, gehalten. Inwiefern könnte dies mit Green Marketing verbunden werden? ","descData":null,"due":null,"idBoard":"4f468facc76804126879a11d","idChecklists":[],"idList":"4f82f6f9906b088d78bd8fed","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":15,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Akquise"}],"name":"Vortrag \"Biogas bei VW\"","pos":98304,"shortLink":"pswuOJn4","shortUrl":"https://trello.com/c/pswuOJn4","subscribed":true,"url":"https://trello.com/c/pswuOJn4/15-vortrag-biogas-bei-vw"},{"id":"4fabe64aba0e01a5470835dd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-10T16:04:55.394Z","desc":"http://www.metaphysic.eu/\n\nein berliner startup, das in den nächsten 3 monaten gelauncht wird. die verkaufen umweltfreundliche beleuchtung, von vorn bis hinten durchdesignt. und machen demnach auch umweltfreundliches marketing. habe die flyer und visitenkarten gesehen, und die sehen ziemlich edel aus. das papier ist von einer speziellen fabrik und auch der druck war/ist CO² frei.\n\nich kenn den gründer, evtl. helf ich ihm bei der website. hab schon mit ihm geredet und er wäre auf jeden fall interessiert.\nviel geld können wir von ihm nicht erwarten (berliner startup -> wenig geld). allerdings sehen diese lampen echt geil aus, evtl. könnten wir für den kongress ein paar bekommen.","descData":null,"due":null,"idBoard":"4f468facc76804126879a11d","idChecklists":[],"idList":"4f82f6f9906b088d78bd8fed","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":32,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Metaphysic","pos":458752,"shortLink":"VYRNrqoR","shortUrl":"https://trello.com/c/VYRNrqoR","subscribed":true,"url":"https://trello.com/c/VYRNrqoR/32-metaphysic"},{"id":"51fe9c3fd2f3653b18002025","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":4,"checkItemsChecked":0,"comments":5,"attachments":0,"description":true,"due":"2013-08-06T15:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-08-08T01:13:24.833Z","desc":"Unser erstes Treffen nach dem Wochenende in Niederlehme!\n\n## Input: ???\n","descData":null,"due":"2013-08-06T15:00:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["51fe9c5b86b6bcaa2d0026fd"],"idList":"51a1d34208f7389574005d3b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":34,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"MeetUp #11 @treptower park","pos":3872,"shortLink":"1ep5mPW8","shortUrl":"https://trello.com/c/1ep5mPW8","subscribed":true,"url":"https://trello.com/c/1ep5mPW8/34-meetup-11-treptower-park"},{"id":"51dd527f7285b0db76002b76","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-12T13:23:45.650Z","desc":"","descData":null,"due":null,"idBoard":"517c21a0b742df086e000e9a","idChecklists":[],"idList":"51a1d34208f7389574005d3b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":33,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Wochenende @Niederlehme","pos":4928,"shortLink":"ZGan6wFB","shortUrl":"https://trello.com/c/ZGan6wFB","subscribed":true,"url":"https://trello.com/c/ZGan6wFB/33-wochenende-niederlehme"},{"id":"51c1bcf279ffed38710026ec","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":9,"checkItemsChecked":9,"comments":10,"attachments":0,"description":true,"due":"2013-06-26T15:30:00.000Z"},"checkItemStates":[{"idCheckItem":"51c1bd0af3eb36f54200291f","state":"complete"},{"idCheckItem":"51c1bd8d720ceb3671002745","state":"complete"},{"idCheckItem":"51c1dfc384e5dfba0f003171","state":"complete"},{"idCheckItem":"51c1e00f99aa472c0e0017c9","state":"complete"},{"idCheckItem":"51c56b181c45390b7a00118b","state":"complete"},{"idCheckItem":"51c56b4f78f9fbbe4800003f","state":"complete"},{"idCheckItem":"51c5d7138d0852931a000806","state":"complete"},{"idCheckItem":"51cb0cbe7ae94a4b6e0030a4","state":"complete"},{"idCheckItem":"51cb12b91c91fde20f003152","state":"complete"}],"closed":false,"dateLastActivity":"2013-06-26T17:06:10.873Z","desc":"# Top 1: Version 1\n\nNur mit Design-Gallerie online gehen? Konflikt: wir stehen für Individualismus!\n\n=>Prio: *Erst* die Gallerie, *dann* das BeuTool\n-----------------\n\n\n# Top 2: Name\n\nDefinitiv am HS-Wochenende!\n\n# Top 3: Buchhaltung\n\nWahl fählt auf Commerzbank, Business Aktiv Konto. Konditionen:\n\n- 6,90 pro Monat Grundgebühr\n- 9 Cent beleglose Buchung ( alles wo kein Bankangestellter mitmacht)\n- Giro Card: 7,5 € pro Jahr\n- Kreditkarte: 30 € pro Jahr, wohl eher unnötig\n- Bargeld an allen Filialen der CashGroup ( alles wo kein Bankangestellter mitmacht)\n- Giro Card: 7,5 € pro Jahr\n- Kreditkarte: 30 € pro Jahr, wohl eher unnötig\n- Bargeld an allen Filialen der CashGroup\n\n# Top 4: Konsequenzen für Geschäftsführer\n\nOli wird Geschäftsführer + Gesellschafter. Frage an den Notar...\n\n# Top 5: Druckfolien\n\nDruck auf schwarz geht mit \"Weißdrucker\" (Kosten ~18€ pro Beutel). Keine perfekte Lösung.\nHenrik fragt: Warum nicht einfach \"transparente\" Zwischenräume Schwarz bedrucken?\nUnd wie machen das die anderen (meinjute.de etc)?\n\n# Top 6: Druckfolien\n\nSchaun wa mal. 10er Satz kostet 10€\nHenrik besorgt 3 Laserdrucker, dann gucken wir mal, wie sich damit drucken lässt.\n\n# Top 7: Roadmap\n\nRoadmap füllen, gruppieren, einteilen. Planen.\n \n# Top 8: Gesellschaftervertrag\n\nMusterprotokoll ist vorhanden. Muss mit Notar abgeklärt werden, was abgeändert werden kann etc.\n\n# Top 9: Homepagedesign\n\nWas ist denn nu mit der Gallerie?\n \n","descData":null,"due":"2013-06-26T15:30:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["51c1bcfc05e22f504d001166"],"idList":"51a1d34208f7389574005d3b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":26,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"MeetUp #9 @TU: MAR4073","pos":11264,"shortLink":"91b9fl2r","shortUrl":"https://trello.com/c/91b9fl2r","subscribed":true,"url":"https://trello.com/c/91b9fl2r/26-meetup-9-tu-mar4073"},{"id":"51af608d7b975922450001c4","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":8,"checkItemsChecked":0,"comments":2,"attachments":0,"description":false,"due":"2013-06-12T15:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-06-19T14:02:08.548Z","desc":"","descData":null,"due":"2013-06-12T15:00:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["51af609c02a3fb1a39000209"],"idList":"51a1d34208f7389574005d3b","idMembers":["517ef7408491d67624002091","4fb4f78b1bb433513cccd759","4f3fe2b13b1374ed33021b1d","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":23,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"MeetUp #7 @headquarter","pos":45056,"shortLink":"iQjFEH8T","shortUrl":"https://trello.com/c/iQjFEH8T","subscribed":true,"url":"https://trello.com/c/iQjFEH8T/23-meetup-7-headquarter"},{"id":"51ab1e79a2e5ed9d77001a38","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":7,"checkItemsChecked":7,"comments":3,"attachments":0,"description":true,"due":"2013-06-05T13:00:00.000Z"},"checkItemStates":[{"idCheckItem":"51ab1fb72c232cd566001e8c","state":"complete"},{"idCheckItem":"51ab1fd4beac745c310030e4","state":"complete"},{"idCheckItem":"51ab20559f9ecebe28000124","state":"complete"},{"idCheckItem":"51ab209c0a72767603001c0b","state":"complete"},{"idCheckItem":"51ab20c01276a86e180033bb","state":"complete"},{"idCheckItem":"51ab22fcbb49135c490009d9","state":"complete"},{"idCheckItem":"51adf96ccfa8b3bc57002e62","state":"complete"}],"closed":false,"dateLastActivity":"2013-06-02T10:29:44.915Z","desc":"## Top 1: Labels benennen\n\n- lila heißt \"muss bis due date entschieden werden\"\n\n## Top 2: Roadmap\nOb ROadmap in dem Umfang sinnvoll ist wird noch geklärt. Viktor bleibt dran!\n\n## Top 3: Arbeitswochenende\nDer Zeitpunkt (12. Juli bis 14. Juli) ist festgelegt. Potentielle Orte: Long Rich Creek\n\n## Top 4: TU-Startup Day\nDas nächste Treffen wird etwas später angelegt. Anschließend gehen wir zum Start-Up Abend im Beta Haus (ab 20.30 Uhr)\nZu den Workshops etc. gehen wir nicht.\n\n## Top 5: Beutel Umfrage (Viktor)\nViktor setzt sich mit Cholotta zusammen und entwickelt eine Qualitative Umfrage, die innerhalb MTP im Umlauf gebracht wird. Evtl. können wir auch das MTP Plenum nutzen, um in einer Art Workshop o.Ä. Ideen zu sammeln. Viktor kümmert sich!\n\n## Top 6: Beuteldruck - Partner/Dienstleister?\nPaul schreibt bis zum nächsten Treffen ein Konzept und stellt dieses vor.\n\n##Top 7: Urheberrechtsfrage\nBeantwortet: siehe [hier](https://trello.com/card/agb-veranderung-hakchen-fur-desginklau/517fa7717ac9d83d24001de0/3))\n\n## Top 8: Feature-Liste\nFeatures für Version 1 wurden beschlossen. Henrik macht Website mit \"Impressum\" und \"Über Uns\" Seiten. Ziel ist, dass das Grund-Design in brauchbarer Form vorhanden ist.\n\n## Sonstiges\nDie Mittwochs-MeetUps werden von nun an immer im HS-Headquarter stattfinden. Außer beim nächsten Mal.\n\n*Protokollant: Henrik*\n","descData":null,"due":"2013-06-05T13:00:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["51ab1e988d653a6b03001ec8"],"idList":"51a1d34208f7389574005d3b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":22,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"MeetUp #6 @HS-Headquarter","pos":90112,"shortLink":"12wqLf0T","shortUrl":"https://trello.com/c/12wqLf0T","subscribed":true,"url":"https://trello.com/c/12wqLf0T/22-meetup-6-hs-headquarter"},{"id":"517f8bcc99d4cb0a67001ccb","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":6,"checkItemsChecked":3,"comments":0,"attachments":0,"description":false,"due":"2013-05-29T13:00:00.000Z"},"checkItemStates":[{"idCheckItem":"519f096d58e4b29f0c0013e7","state":"complete"},{"idCheckItem":"51a0b701c248c8d517006f00","state":"complete"},{"idCheckItem":"51a1c57c99ce1ac97d004ac3","state":"complete"}],"closed":false,"dateLastActivity":"2013-05-24T06:31:57.005Z","desc":"","descData":null,"due":"2013-05-29T13:00:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["519f095c7917a7b20c0012ee"],"idList":"51a1d34208f7389574005d3b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":14,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"MeetUp #5@henrik","pos":180224,"shortLink":"RHOGu4O3","shortUrl":"https://trello.com/c/RHOGu4O3","subscribed":true,"url":"https://trello.com/c/RHOGu4O3/14-meetup-5-henrik"},{"id":"51dd32d737567286010017d7","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-10T10:11:05.218Z","desc":"Wir müssen uns mal um die Frage kümmern, wie wir mit den Usern umgehen wollen.\n\nist ne Grundüberlegung","descData":null,"due":null,"idBoard":"517c213d5e712b126e0024eb","idChecklists":[],"idList":"51c56c17c22d20ea790019af","idMembers":["4f357259497d87255b0469e3","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":31,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"User Verwaltung?","pos":589824,"shortLink":"LVO6i0L5","shortUrl":"https://trello.com/c/LVO6i0L5","subscribed":true,"url":"https://trello.com/c/LVO6i0L5/31-user-verwaltung"},{"id":"51810413bf1e88b075003753","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":1,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-14T10:17:00.336Z","desc":"!Lasst uns mal bedenken, dass wir vielleicht einen Fanatasienamen machen können. \nKrabba - Der Hipsterscheiss oder so...!\n\nIdeen:\nBeuTool\nHipstarscheiss.de\nBeutelhelden\nHipsterscheiss.de\n","descData":null,"due":null,"idBoard":"517f999d814b8d142a001dd6","idChecklists":["51e27a9c580a8d1138003675"],"idList":"517f999d814b8d142a001dd7","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":3,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":""}],"name":"Namensfindung","pos":16384,"shortLink":"hd6lC5GD","shortUrl":"https://trello.com/c/hd6lC5GD","subscribed":true,"url":"https://trello.com/c/hd6lC5GD/3-namensfindung"},{"id":"519ceb5aa93f0410250005be","badges":{"votes":1,"viewingMemberVoted":true,"subscribed":true,"fogbugz":"","checkItems":5,"checkItemsChecked":0,"comments":5,"attachments":0,"description":true,"due":"2013-07-12T16:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-12T13:26:44.335Z","desc":"http://doodle.com/hgdhbr8gkt9khndq","descData":null,"due":"2013-07-12T16:00:00.000Z","idBoard":"517c21a0b742df086e000e9a","idChecklists":["51dd947ebd0d50987f00078c"],"idList":"517c21a0b742df086e000e9b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":["4f357259497d87255b0469e3"],"idShort":10,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":"muss entschieden werden"}],"name":"ArbeitsWochenende","pos":98304,"shortLink":"ZgwRlEvz","shortUrl":"https://trello.com/c/ZgwRlEvz","subscribed":true,"url":"https://trello.com/c/ZgwRlEvz/10-arbeitswochenende"},{"id":"51da940d258101353f00a29a","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":3,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-19T07:53:24.019Z","desc":"**Notar Nikolas Polak**\nTel: 030 24723400\nFax: 030 86409952\n(Kontakt kommt zustande über seinen Kollegen Manfred Kühne, der sehr gut mit Henriks Vater Ulrich Zipse befreundet ist)\n","descData":null,"due":null,"idBoard":"517fa7717ac9d83d24001de0","idChecklists":[],"idList":"517fa7717ac9d83d24001de1","idMembers":["517ef7408491d67624002091","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":8,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Notarkontakt","pos":163840,"shortLink":"lRYv9QKG","shortUrl":"https://trello.com/c/lRYv9QKG","subscribed":true,"url":"https://trello.com/c/lRYv9QKG/8-notarkontakt"},{"id":"51dd41ac6867145b3a0018aa","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":6,"checkItemsChecked":0,"comments":3,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-12T08:51:14.668Z","desc":"","descData":null,"due":null,"idBoard":"517c21a0b742df086e000e9a","idChecklists":["51dd9453bec501317b000ac8"],"idList":"517c21a0b742df086e000e9b","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":31,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"ArbeitsWochenende: Einkaufsliste","pos":163840,"shortLink":"Gfs2EFbi","shortUrl":"https://trello.com/c/Gfs2EFbi","subscribed":true,"url":"https://trello.com/c/Gfs2EFbi/31-arbeitswochenende-einkaufsliste"},{"id":"5188b45f6754a6f40c010752","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":8,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-14T10:34:18.036Z","desc":"Skimming - high margin -> higher ROI\nor\nPenetration - low margin -> mass market","descData":null,"due":null,"idBoard":"517f999d814b8d142a001dd6","idChecklists":["5188bfa62ee5a2a825011196"],"idList":"517f999d814b8d142a001dd7","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":8,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":""}],"name":"Price Strategy Entscheidung","pos":229376,"shortLink":"qDM1AhUx","shortUrl":"https://trello.com/c/qDM1AhUx","subscribed":true,"url":"https://trello.com/c/qDM1AhUx/8-price-strategy-entscheidung"},{"id":"5180f945bd064bd72b003ab7","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":2,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-06-13T18:06:28.069Z","desc":"Welche keywords werden auf Google etc eingegeben, was kostet Werbung? Wieviele optimieren auf diese keywords ","descData":null,"due":null,"idBoard":"517c2125b9141489220029b4","idChecklists":["51ba0a24bdd9e1a8260005c4"],"idList":"517c2125b9141489220029b5","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":5,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Tracking und Optimierung","pos":147456,"shortLink":"gdZoLxQi","shortUrl":"https://trello.com/c/gdZoLxQi","subscribed":true,"url":"https://trello.com/c/gdZoLxQi/5-tracking-und-optimierung"},{"id":"51dd2f9d742b175e510001e5","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-10T09:56:30.337Z","desc":"Das Galleriekonzept liegt im Gdrive:\nhttps://docs.google.com/document/d/1DH_EKsOWWTa68jOBSLtqLmzo7uZ7_3HYgajcaU66mg0/edit","descData":null,"due":null,"idBoard":"517f999d814b8d142a001dd6","idChecklists":[],"idList":"517f999d814b8d142a001dd8","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":4,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":""}],"name":"First Gallerykozept","pos":73728,"shortLink":"C73Oh7zu","shortUrl":"https://trello.com/c/C73Oh7zu","subscribed":true,"url":"https://trello.com/c/C73Oh7zu/4-first-gallerykozept"},{"id":"51af4fdd06ed04d8550060ce","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":7,"checkItemsChecked":4,"comments":10,"attachments":0,"description":false,"due":null},"checkItemStates":[{"idCheckItem":"51af500f67b2e4e17a002221","state":"complete"},{"idCheckItem":"51af5042aaa0feed310020e9","state":"complete"},{"idCheckItem":"51af5075bcc905b7370042cf","state":"complete"},{"idCheckItem":"51af5db6d2b62e2339000221","state":"complete"}],"closed":false,"dateLastActivity":"2013-07-11T15:11:34.957Z","desc":"","descData":null,"due":null,"idBoard":"517c21805afd37971e002c9c","idChecklists":["51af5007068ce07907002600"],"idList":"517c21805afd37971e002c9e","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":8,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":""}],"name":"Sportbeutel","pos":98304,"shortLink":"30JJchpI","shortUrl":"https://trello.com/c/30JJchpI","subscribed":true,"url":"https://trello.com/c/30JJchpI/8-sportbeutel"},{"id":"519cebe21e869bff240004ab","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":4,"checkItemsChecked":0,"comments":4,"attachments":1,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-05-22T16:04:36.124Z","desc":"","descData":null,"due":null,"idBoard":"517c21a0b742df086e000e9a","idChecklists":["519cec2576a68ace44000681"],"idList":"517c21a0b742df086e000e9c","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4fb4f78b1bb433513cccd759","4f3fe2b13b1374ed33021b1d"],"idMembersVoted":[],"idShort":11,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":"muss entschieden werden"}],"name":"Dauer der Zielphase(1)-Aufgaben bestimmen und mögliche Reihenfolge festlegen","pos":131072,"shortLink":"yV5MDoNc","shortUrl":"https://trello.com/c/yV5MDoNc","subscribed":true,"url":"https://trello.com/c/yV5MDoNc/11-dauer-der-zielphase-1-aufgaben-bestimmen-und-mogliche-reihenfolge-festlegen"},{"id":"518a522781744803710039d0","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-06-13T19:08:05.595Z","desc":"Entscheidung:\nUg wurde unter Veto(Krankenkasse) zugegestimmt","descData":null,"due":null,"idBoard":"517f999d814b8d142a001dd6","idChecklists":[],"idList":"517f999d814b8d142a001dd9","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":2,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"purple","name":""}],"name":"Entscheidung UG vs. GWR","pos":16384,"shortLink":"OUpdId6Q","shortUrl":"https://trello.com/c/OUpdId6Q","subscribed":true,"url":"https://trello.com/c/OUpdId6Q/2-entscheidung-ug-vs-gwr"},{"id":"4f8e7d3732818cb342fceebd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":10,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2012-05-02T16:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-13T19:36:48.262Z","desc":"","descData":null,"due":"2012-05-02T16:00:00.000Z","idBoard":"4f468facc76804126879a11d","idChecklists":["4f8e7e7d4d10005345373eb9"],"idList":"4f468facc76804126879a123","idMembers":["4f468e4822528aac66f02343","4f4d2351c3c6fdda72e31228","4f4d134dc57785d3726e5954","4f4d1976c3c6fdda72dc46bb","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":22,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"green","name":"Gesamt"}],"name":"Jour fix am 02.05.","pos":24576,"shortLink":"Qu5JC3Lk","shortUrl":"https://trello.com/c/Qu5JC3Lk","subscribed":true,"url":"https://trello.com/c/Qu5JC3Lk/22-jour-fix-am-02-05"},{"id":"4f48fd156aeb53475f05ce3f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":9,"attachments":0,"description":false,"due":"2012-04-01T07:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-04-09T14:48:49.593Z","desc":"","descData":null,"due":"2012-04-01T07:00:00.000Z","idBoard":"4f468facc76804126879a11d","idChecklists":[],"idList":"4f468facc76804126879a123","idMembers":["4f3fe2b13b1374ed33021b1d","4f44e69bc76804126895649f","4f468e4822528aac66f02343","4f4d1976c3c6fdda72dc46bb","4f4d2351c3c6fdda72e31228","4f4d134dc57785d3726e5954","4f357259497d87255b0469e3","4f3fe2eba34a8c9221062864"],"idMembersVoted":[],"idShort":2,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"green","name":"Gesamt"}],"name":"Kick Off Meeting","pos":32768,"shortLink":"SfvsLs5T","shortUrl":"https://trello.com/c/SfvsLs5T","subscribed":true,"url":"https://trello.com/c/SfvsLs5T/2-kick-off-meeting"},{"id":"5180ed984df179a371001a4a","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":3,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-19T07:55:26.782Z","desc":"Telefonnummer von Nikolaus Polak: 8642 4010","descData":null,"due":null,"idBoard":"517fa7717ac9d83d24001de0","idChecklists":[],"idList":"517fa7717ac9d83d24001de3","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":1,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Notar besorgen ","pos":73728,"shortLink":"gBhg6lFv","shortUrl":"https://trello.com/c/gBhg6lFv","subscribed":true,"url":"https://trello.com/c/gBhg6lFv/1-notar-besorgen"},{"id":"4fb76ea3dc9c4b5a55303f84","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":3,"checkItemsChecked":0,"comments":3,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-28T21:40:16.550Z","desc":"PlanForMe ist eine App, die dem Benutzen den Tag plant und effizienter gestaltet! \n\nNach einer Auflistung seiner Todos und Wants plant die App die Woche für den Benutzer!\n\nSie verbindet unangenehme Sache mit angenehmen sachen und schaut immer, ob es gerade eine Besser Möglichkeit gibt ToDos zu verbinden. \n\nAbrechnung-> Sport-> Geldholen-> Bar mit Timo\n\n\n### Pro: \n\n* Produktivität\n* Effizienz\n* Shareble\n\n### Contra:\n\n* Hemmung zur Datenpreisgabe\n* Schnittstellen","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":["4fc3f0c05d951ab751722d56"],"idList":"4fb4fc198a53565b56d5ccfb","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":9,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"green","name":""}],"name":"PlanForMe","pos":262144,"shortLink":"dbWutPLw","shortUrl":"https://trello.com/c/dbWutPLw","subscribed":true,"url":"https://trello.com/c/dbWutPLw/9-planforme"},{"id":"520a3a7495f3ef4b14002ed0","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":17,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-08-13T16:53:59.636Z","desc":"","descData":null,"due":null,"idBoard":"520a38ee14d1ed591400322f","idChecklists":["520a3ab64c7d4b7a0d0020a1"],"idList":"520a39a82259a9256f003674","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":4,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Packliste","pos":81920,"shortLink":"IHrAhfE5","shortUrl":"https://trello.com/c/IHrAhfE5","subscribed":true,"url":"https://trello.com/c/IHrAhfE5/4-packliste"},{"id":"520b3c45684c59306d00091c","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":19,"checkItemsChecked":19,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[{"idCheckItem":"520b3c45684c59306d00091e","state":"complete"},{"idCheckItem":"520b3c45684c59306d00091f","state":"complete"},{"idCheckItem":"520b3c45684c59306d000920","state":"complete"},{"idCheckItem":"520b3c45684c59306d000922","state":"complete"},{"idCheckItem":"520b3c45684c59306d000923","state":"complete"},{"idCheckItem":"520b3c45684c59306d000924","state":"complete"},{"idCheckItem":"520b3c45684c59306d000925","state":"complete"},{"idCheckItem":"520b3c45684c59306d000926","state":"complete"},{"idCheckItem":"520b3c45684c59306d000927","state":"complete"},{"idCheckItem":"520b3c45684c59306d000929","state":"complete"},{"idCheckItem":"520b3c45684c59306d00092a","state":"complete"},{"idCheckItem":"520b3c45684c59306d00092b","state":"complete"},{"idCheckItem":"520b3c45684c59306d00092d","state":"complete"},{"idCheckItem":"520b3c45684c59306d00092e","state":"complete"},{"idCheckItem":"520b3e3a159eb92e4a000585","state":"complete"},{"idCheckItem":"520b3e84c119d96c070004a9","state":"complete"},{"idCheckItem":"520b43a70635ed44070008e9","state":"complete"},{"idCheckItem":"520b45107873864a6d000924","state":"complete"},{"idCheckItem":"520b48b781aeaa6c06000999","state":"complete"}],"closed":false,"dateLastActivity":"2013-08-14T09:23:02.415Z","desc":"","descData":null,"due":null,"idBoard":"520a38ee14d1ed591400322f","idChecklists":["520b3c45684c59306d00091d"],"idList":"520a39a82259a9256f003674","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":7,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Packliste (Henrik)","pos":114688,"shortLink":"d8osrtY8","shortUrl":"https://trello.com/c/d8osrtY8","subscribed":true,"url":"https://trello.com/c/d8osrtY8/7-packliste-henrik"},{"id":"520a3b23fd1be6b03c002264","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":5,"checkItemsChecked":5,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[{"idCheckItem":"520a3b47ceca21a36f0033a9","state":"complete"},{"idCheckItem":"520a3b4a7a6fdd0f6f001fd3","state":"complete"},{"idCheckItem":"520a3b5fac87c17b0d0039c5","state":"complete"},{"idCheckItem":"520a3b66071c7a2824000ab3","state":"complete"},{"idCheckItem":"520a3b7bf83d77b76f0022e3","state":"complete"}],"closed":false,"dateLastActivity":"2013-08-14T08:10:41.405Z","desc":"","descData":null,"due":null,"idBoard":"520a38ee14d1ed591400322f","idChecklists":["520a3b3fa0c1758614003238"],"idList":"520a39a82259a9256f003674","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":5,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Dokumente","pos":147456,"shortLink":"WejwJh71","shortUrl":"https://trello.com/c/WejwJh71","subscribed":true,"url":"https://trello.com/c/WejwJh71/5-dokumente"},{"id":"51e6661329ef12da5d004430","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":4,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-22T18:40:14.839Z","desc":"## Step 1\nIhr schreibt eure ToDos auf Karten und fügt ggf. eine Beschreibung, Dateien, Bilder und/oder Checklisten hinzu\n\n## Step 2\nIhr fügt euch selber als Member der Karte hinzu\n\n## Step 3\nGibt es noch Blockaden für dieses ToDo? D.h. gibt es noch Fragen/Aufgaben, die ihr selber nicht beantworten könnt? Dann fügt das Laben **Blockade/Noch Fragen in der Gruppe** hinzu\n\n### Step 3b\nFalls die Blockade von einem anderen Ressort abhängt (z.B. muss eine rechtliche Frage geklärt werden) dann fügt den Ressort-Leiter als Card-Member hinzu.\n\nIhr könnt euch auch auf eine andere Karte in diesem Board referenzieren, indem ihr \"Hängt ab von #Card-Nummer\" in die Card schreibt. Die Card-Nummer findet ihr immer unten rechts (z.B. ist dies hier Card #18 )\n\n## Step 4\nSchiebt die Cards solange in den Listen (=Kalenderwochen) hin und her, bis es euch gefällt\n\n## Step 5\nDie anderen Labels sind selbsterklärend: Falls ihr merkt, dass ihr das ToDo in der vorgesehenen Zeit nicht schafft, fügt das Label **Könnte zeitlich knapp werden** hinzu. Ist das ToDo erledigt, dann kommt das Label **Erledigt!** zum Einsatz. \n\nSind alle ToDos in einer Liste (=Kalenderwoche) erledigt, wird diese Liste archiviert, damit dieses Board nicht zu unübersichtlich wird. Die Liste wird mit der \"Move List\" Funktion einfach auf ein anderes Board (**Roadmap Archiv**) verschoben, das nur als Archiv für die Roadmap vorgesehen ist, d.h. dort bitte keine neuen Cards erstellen\n\n# Praktische Tricks\n\nRechts im Menü gibt es verschiedene Filterfunktionen: z.B. kann man sich nur Cards anzeigen lassen, in denen man selber für Zuständig ist. Oder man lässt sich alle Cards mit dem Label \"Blockade\" anzeigen um besser zu sehen, was unbedingt geklärt werden muss. \n","descData":null,"due":null,"idBoard":"51e66aba65deb9822b003e65","idChecklists":[],"idList":"51e45d56728d5da35d000684","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":2,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Roadmap-Anleitung: Wie wir diese Roadmap benutzen können","pos":65535,"shortLink":"3BiaTwux","shortUrl":"https://trello.com/c/3BiaTwux","subscribed":true,"url":"https://trello.com/c/3BiaTwux/2-roadmap-anleitung-wie-wir-diese-roadmap-benutzen-konnen"},{"id":"4fc3f2e79888d25d63a1c9fa","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":12,"checkItemsChecked":0,"comments":1,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-29T08:11:07.412Z","desc":"","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":["4fc3f34d9888d25d63a1d3f4"],"idList":"4fb4fc198a53565b56d5ccf9","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":24,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"ScreenChanger","pos":65536,"shortLink":"XcAUSHlz","shortUrl":"https://trello.com/c/XcAUSHlz","subscribed":true,"url":"https://trello.com/c/XcAUSHlz/24-screenchanger"},{"id":"4fb7b1f2fa6db9ca4b340026","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-25T10:50:41.252Z","desc":"* Der Bäcker nebenan macht gleich Feierabend und will noch 5 Crossaints zum halben Preis raushauen.\n* Der Dönermann gegenüber hat heute ein Angebot: Chickendöner für nur 2€\n* Im Café um die Ecke findet heute abend eine kleine live jazz session statt\n* Die Pizzeria in der Parallelstraße hat heute ne neue Pizza im Angebot\n\nWie können solche lokalen angebote promoted werden? Wäre doch cool, wenn der Bäcker das kurz in seine App/Website/Whatever eingibt und ich, der gerade zuhause sitzt und irgendwas macht, bekomm ne kleine notification, hab gerade hunger und geh schnell runter und hol mir die teile.\n\n\nPro:\n*Lokal\n*Einfach\n\nContra:\n*Konkurenz\n\n\nContra:","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":[],"idList":"4fb4fc198a53565b56d5ccf9","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":12,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"yellow","name":"Open for Discussion"}],"name":"Local Newsfeed","pos":294912,"shortLink":"HEoOkMWr","shortUrl":"https://trello.com/c/HEoOkMWr","subscribed":true,"url":"https://trello.com/c/HEoOkMWr/12-local-newsfeed"},{"id":"4fb76eb2dc9c4b5a553040d1","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":2,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-06-08T05:31:06.197Z","desc":"Es gibt Kongresse, Tagungen, Seminare ....\n\nAuf Allen wird geredet, Genetworked, Themen weitergeben.\n\nEs gibt große, kleine, private, öffentliche!\n\nDas WhiteLabel ist eine \"Standart\" Lösung die belieben aufgestockt werden kann und nicht nötigen Daten zum Kongress bietet.\n\nDurch die Anbindung der Daten aus dem Backend, kann jemand, der auf mehrer Kongresse geht, sich mehr als nur ein Kongress in EINER App anzeigen lassen und Verknüpfen! \n\nEinfach, Universial mit Großer nachfrage! \n\n","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":[],"idList":"4fb4fc198a53565b56d5ccf9","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":10,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"yellow","name":"Open for Discussion"}],"name":"Kongress App- WhiteLabel","pos":327680,"shortLink":"uBJPMECY","shortUrl":"https://trello.com/c/uBJPMECY","subscribed":true,"url":"https://trello.com/c/uBJPMECY/10-kongress-app-whitelabel"},{"id":"4fbab580950f3b4d163b042e","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":2,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-25T10:11:35.015Z","desc":"Diese app fragt im selber festzulegenen Zeitabstand bestimmte Dinge nach, z.B. wie es dir gerade geht (ggf. warum) wie Produktiv/ausgeschlafen du dich fühlst etc.\nZiel ist es, möglichst viele Statistiken über den eigenen Gemütszustand zu sammeln und diese dann auszuwerten. Heraus kommen dann interessante zusammenhänge wie \"Am Produktivsten fühl ich mich, wenn ich nachts 5 Stunden schlafe, um 13 Uhr in Kantine X mit Martin mein Mittag mache, anschließend nochmal 2 Stunden schlafe und bis spät Abends durcharbeite\" oder \"In der Woche schaff ich am meisten, wenn ich Montags Mittag 2 Stunden Tennis spielen gehe\".\n\nMan kann die Statistiken noch mit dem eigenen Google Kalender verknüpfen und dann solche Dinge herausbekommen wie \"Nach jedem Dienstagmeeting gehts mir richtig scheiße\". \n\nGeld kann auch gemacht werden, indem anhand der vorhandenen Daten eine Aussage über den derzeitigen gemütszustand getroffen wird und entsprechende Werbeanzeigen geschaltet werden können: Fröhliche Anzeigen bei guter Stimmung, mitfühlende Anzeigen bei schlechter Stimmung etc.\n\nDurch diese App kannst Du deine Produktivität steigern (bzw. optimieren) oder einfach nur mehr über dich selber herausfinden. Sie kann aber auch als micro-diary genutzt werden.\n\nPro:\n* Verbesserung der Stimmung des Benutzers\n* \n\nContra:\n* Schnittstelle zum Kalender\n* ","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":[],"idList":"4fb4fc198a53565b56d5ccf9","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":13,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"yellow","name":"Open for Discussion"}],"name":"App: What's your Mood?","pos":458752,"shortLink":"IBhEegUL","shortUrl":"https://trello.com/c/IBhEegUL","subscribed":true,"url":"https://trello.com/c/IBhEegUL/13-app-what-s-your-mood"},{"id":"4fbca4f60198f39a2b8b694f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2012-05-25T10:35:38.057Z","desc":"Der MedicalShip! \n\nDie Zukunftsmusik von Morgen in den heutigen Ohren!\n\nDer Ship der unter die Haut eingeplanzt wird! \n\nDen Rest könnt ihr euch denken!  \n\n","descData":null,"due":null,"idBoard":"4fb4fc198a53565b56d5ccf5","idChecklists":[],"idList":"4fb4fc198a53565b56d5ccf9","idMembers":["4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":14,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"orange","name":"Under Construction"}],"name":"MedicalShip","pos":524288,"shortLink":"32qdYPtN","shortUrl":"https://trello.com/c/32qdYPtN","subscribed":true,"url":"https://trello.com/c/32qdYPtN/14-medicalship"},{"id":"51e45db965b8f85e6a00066f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-02T13:49:44.820Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45d6f785c722226000766","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":1,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"green","name":"Erledigt!"}],"name":"Beutool: Framework planen","pos":16383.75,"shortLink":"vxDATogD","shortUrl":"https://trello.com/c/vxDATogD","subscribed":true,"url":"https://trello.com/c/vxDATogD/1-beutool-framework-planen"},{"id":"5188cb465048285c7b0112d3","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":5,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-19T16:59:57.596Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":["51ba0567b6f945950e0002ab"],"idList":"51e45d6f785c722226000766","idMembers":["4fb4f78b1bb433513cccd759","517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":36,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Coperate Design  (Formen Design)","pos":32767.75,"shortLink":"bpX7pGoU","shortUrl":"https://trello.com/c/bpX7pGoU","subscribed":true,"url":"https://trello.com/c/bpX7pGoU/36-coperate-design-formen-design"},{"id":"51e4671ea25be670460005a5","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-15T21:21:28.877Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460cbf54395782b0007a4","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":7,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Beutool: Framework implementieren","pos":131071,"shortLink":"1IOlrGTV","shortUrl":"https://trello.com/c/1IOlrGTV","subscribed":true,"url":"https://trello.com/c/1IOlrGTV/7-beutool-framework-implementieren"},{"id":"51e45eebe411bb6d6a00073e","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-08-12T13:04:31.390Z","desc":"Hängt ab von #2","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460cbf54395782b0007a4","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":4,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: AGBs","pos":163839,"shortLink":"OdD19CKO","shortUrl":"https://trello.com/c/OdD19CKO","subscribed":true,"url":"https://trello.com/c/OdD19CKO/4-website-agbs"},{"id":"51e45dc8c4719b8f460006e2","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":2,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-02T14:33:14.961Z","desc":"Enthält die Frontpage\n\nes geht nur um die funktionalität (wahrscheinlich werde ich dafür alle wichtigen bildelemente - vorallem das hintergrundbild - selber zeichnen)\n\nDas \"perfekte\" Design zu finden ist ein ständiger Prozess","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460cbf54395782b0007a4","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":2,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: Grund-Design implementieren + Funktionalität","pos":167935,"shortLink":"VpkPeZ2o","shortUrl":"https://trello.com/c/VpkPeZ2o","subscribed":true,"url":"https://trello.com/c/VpkPeZ2o/2-website-grund-design-implementieren-funktionalitat"},{"id":"51e45dda8c3c5e8a60000329","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-08-12T13:04:33.539Z","desc":"Hängt ab von #2","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460cbf54395782b0007a4","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":3,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: Impressum","pos":172031,"shortLink":"lZcy8fwZ","shortUrl":"https://trello.com/c/lZcy8fwZ","subscribed":true,"url":"https://trello.com/c/lZcy8fwZ/3-website-impressum"},{"id":"51e45eef038355f9290006cd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-08-12T13:04:32.284Z","desc":"Hängt ab von #2","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460cbf54395782b0007a4","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":5,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: Über Uns","pos":180223,"shortLink":"plSYklle","shortUrl":"https://trello.com/c/plSYklle","subscribed":true,"url":"https://trello.com/c/plSYklle/5-website-uber-uns"},{"id":"51e467cd40b8ddc046000981","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-15T21:21:33.347Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45cfc830202965c00067b","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":8,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Beutool: Upload Funktionalität","pos":65535,"shortLink":"hkduEv7l","shortUrl":"https://trello.com/c/hkduEv7l","subscribed":true,"url":"https://trello.com/c/hkduEv7l/8-beutool-upload-funktionalitat"},{"id":"51e466f341f362940e00079c","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-02T13:50:29.007Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45cfc830202965c00067b","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":6,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: Beutool Design","pos":98303,"shortLink":"WhtuU6zb","shortUrl":"https://trello.com/c/WhtuU6zb","subscribed":true,"url":"https://trello.com/c/WhtuU6zb/6-website-beutool-design"},{"id":"51e46842449201542600079f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-18T15:53:37.928Z","desc":"## Fragen\n* Welche Effekte?\n* Wieviele? \n> 6\n* Sehen Filter-Effekte gedruckt überhaupt gut aus?","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45cfc830202965c00067b","idMembers":["4f357259497d87255b0469e3","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":10,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Beutool: Filter Effekte","pos":131071,"shortLink":"dHIihOsb","shortUrl":"https://trello.com/c/dHIihOsb","subscribed":true,"url":"https://trello.com/c/dHIihOsb/10-beutool-filter-effekte"},{"id":"51e4690cc6d10b6e260008ae","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-17T09:13:06.496Z","desc":"## Fragen\n* Welche Zahlungsart(en) bieten wir an?","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45d52b80056bc5d00071f","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d"],"idMembersVoted":[],"idShort":13,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Website: Checkout Prozess","pos":32767.5,"shortLink":"AuuGUYhH","shortUrl":"https://trello.com/c/AuuGUYhH","subscribed":true,"url":"https://trello.com/c/AuuGUYhH/13-website-checkout-prozess"},{"id":"51e468f14763688e6a0007ab","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-17T09:12:51.237Z","desc":"## Fragen\n* Was sind die gesetzlichen Vorgaben?","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45d52b80056bc5d00071f","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091"],"idMembersVoted":[],"idShort":12,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Backend: Userdaten Speicherung","pos":65535,"shortLink":"qBXfT0oy","shortUrl":"https://trello.com/c/qBXfT0oy","subscribed":true,"url":"https://trello.com/c/qBXfT0oy/12-backend-userdaten-speicherung"},{"id":"51e7b234c63197272c003a93","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-05T10:54:21.269Z","desc":"UG muss gegründet sein\nHängt ab von #21","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45d52b80056bc5d00071f","idMembers":["4fb4f78b1bb433513cccd759","517ef7408491d67624002091","4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d"],"idMembersVoted":[],"idShort":22,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Konto eröffnen","pos":360447,"shortLink":"P0dgt85I","shortUrl":"https://trello.com/c/P0dgt85I","subscribed":true,"url":"https://trello.com/c/P0dgt85I/22-konto-eroffnen"},{"id":"51e7b22de16b3e5f48001718","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-05T10:54:52.440Z","desc":"Hängt ab von #21","descData":{"emoji":{}},"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e45d52b80056bc5d00071f","idMembers":["517ef7408491d67624002091","4f3fe2b13b1374ed33021b1d","4fb4f78b1bb433513cccd759","4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":21,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Anmeldung Finanzamt","pos":425983,"shortLink":"UDrFQkau","shortUrl":"https://trello.com/c/UDrFQkau","subscribed":true,"url":"https://trello.com/c/UDrFQkau/21-anmeldung-finanzamt"},{"id":"51e468b5a064668c0e0004a4","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-17T09:13:12.913Z","desc":"Hängt ab von Druckerei & Druckverfahren\n\n## Fragen\n* Welches geometrisches Format ist gewünscht?\n* Welche Dateiformat?\n* Farbräume?\n* Sonstige optimierungen","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460440e2836ac5c000535","idMembers":["4f357259497d87255b0469e3","4f3fe2b13b1374ed33021b1d"],"idMembersVoted":[],"idShort":11,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Dateiexport für Druck","pos":65535,"shortLink":"Ncvm3uUc","shortUrl":"https://trello.com/c/Ncvm3uUc","subscribed":true,"url":"https://trello.com/c/Ncvm3uUc/11-dateiexport-fur-druck"},{"id":"51e469c59e7d45e05d0005da","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-09-03T20:43:32.736Z","desc":"## Fragen\n* Wieviele Designs werden es sein?\n* In welchem Format sind die Designs (Hochkant/Quer)?","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e460440e2836ac5c000535","idMembers":["4f357259497d87255b0469e3","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":14,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Website: Gallery Design","pos":196607,"shortLink":"DXmVEWUy","shortUrl":"https://trello.com/c/DXmVEWUy","subscribed":true,"url":"https://trello.com/c/DXmVEWUy/14-website-gallery-design"},{"id":"51e4682f42fb8a4c02000970","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-17T09:15:27.119Z","desc":"## Fragen\n* gibt es gesetzliche Richtlinien/Vorgaben/Verpflichtungen? Zu überprüfen sind: *Cookies*, *Tracking-Tools von Drittanbietern* (z.B. Google Analytics)","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e4669a9c681daf2b000600","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091"],"idMembersVoted":[],"idShort":9,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Website: Tracking Tools","pos":65535,"shortLink":"nk6R6RTQ","shortUrl":"https://trello.com/c/nk6R6RTQ","subscribed":true,"url":"https://trello.com/c/nk6R6RTQ/9-website-tracking-tools"},{"id":"51e46b4374b96a360200077a","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":6,"checkItemsChecked":0,"comments":0,"attachments":0,"description":true,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-19T20:21:25.623Z","desc":"Die Texte müssen geschrieben werden","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":["51e46b58258e185c02000b6d"],"idList":"51e4669a9c681daf2b000600","idMembers":["4f357259497d87255b0469e3","517ef7408491d67624002091","4fb4f78b1bb433513cccd759"],"idMembersVoted":[],"idShort":17,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"color":"red","name":"Blockade / Noch Fragen in der Gruppe zu klären"}],"name":"Website: Platzhaltertexte ersetzen","pos":81919.25,"shortLink":"EDsXic7s","shortUrl":"https://trello.com/c/EDsXic7s","subscribed":true,"url":"https://trello.com/c/EDsXic7s/17-website-platzhaltertexte-ersetzen"},{"id":"51e46aba20cb85d10e000854","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-15T21:39:58.893Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e4669a9c681daf2b000600","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":16,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Website: Testing & Debugging","pos":98303.5,"shortLink":"lA0J5HRv","shortUrl":"https://trello.com/c/lA0J5HRv","subscribed":true,"url":"https://trello.com/c/lA0J5HRv/16-website-testing-debugging"},{"id":"51e46aad072e7dba46000930","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2013-07-15T21:34:57.351Z","desc":"","descData":null,"due":null,"idBoard":"51e45cfc830202965c000678","idChecklists":[],"idList":"51e4669d072e7dba460007d7","idMembers":["4f357259497d87255b0469e3"],"idMembersVoted":[],"idShort":15,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"name":"Beutool: Testing & Debugging","pos":32767.5,"shortLink":"IdtG9woR","shortUrl":"https://trello.com/c/IdtG9woR","subscribed":true,"url":"https://trello.com/c/IdtG9woR/15-beutool-testing-debugging"}];
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